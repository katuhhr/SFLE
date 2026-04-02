from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta, datetime as dt
from django.db import transaction
from django.db.models import Prefetch, Min
from django.db.utils import DatabaseError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from users.models import (
    User,
    Group,
    Request,
    Schedule,
    Theory,
    Theme,
    Material,
    Major,
    Course,
    GradebookSheet,
)
from users.major_labels import majors_for_learning_catalog, major_theory_bundle_label
from student.serializers import (
    TheoryLearningTreeSerializer,
    MaterialNodeSerializer,
    ThemeCatalogSerializer,
    ThemeCommonSelfStudySerializer,
)
from .serializers import (
    ApplicationSerializer, TeacherSerializer, GroupSerializer,
    GroupCreateSerializer, TeacherGroupUpdateSerializer, ScheduleEntrySerializer,
    GroupOptionSerializer,
)


def _admin_only(user) -> bool:
    return getattr(user, 'role', None) == 'admin'


#заявки преподов
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_applications(request):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    applications = Request.objects.select_related('user').all().order_by('-id')
    serializer = ApplicationSerializer(applications, many=True)

    return Response({
        'status': 'success',
        'data': serializer.data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_application_detail(request, app_id):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    application = get_object_or_404(Request, id=app_id)
    serializer = ApplicationSerializer(application)

    return Response({
        'status': 'success',
        'data': serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_application(request, app_id):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    application = get_object_or_404(Request, id=app_id)
    #получаем данные из заявки (нужно будет расширить модель Request)
    #пока используем существующего пользователя
    user = application.user
    
    if user:
        if application.type == 'student_registration_confirm':
            # Подтверждение регистрации студента: просто делаем активным
            user.is_active = True
            user.role = 'student'
            user.save()
        else:
            # Старое поведение: пользователь становится преподавателем
            user.role = 'teacher'
            user.is_active = True
            user.save()
    
    #удаляем заявкуменяем статус
    application.delete()
    
    return Response({
        'status': 'success',
        'message': f'Заявка одобрена. Пользователь {user.username} теперь преподаватель.'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_application(request, app_id):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    application = get_object_or_404(Request, id=app_id)
    reason = request.data.get('reason', 'Причина не указана')
    #сохраняем причину отказа (нужно будет добавить поле в модель Request)
    #пока просто удаляем заявку/пользователя
    if application.type == 'student_registration_confirm':
        # Для отклонённой заявки студента удаляем и студента
        application.user.delete()
    application.delete()
    
    return Response({
        'status': 'success',
        'message': f'Заявка отклонена. Причина: {reason}'
    })


#преподы
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_teachers(request):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    teachers = User.objects.filter(role='teacher').select_related('group')
    serializer = TeacherSerializer(teachers, many=True)

    return Response({
        'status': 'success',
        'data': serializer.data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_teacher_detail(request, teacher_id):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    teacher = get_object_or_404(
        User.objects.select_related('group'),
        id=teacher_id,
        role='teacher',
    )
    serializer = TeacherSerializer(teacher)

    return Response({
        'status': 'success',
        'data': serializer.data,
    })


@api_view(['GET', 'POST', 'PUT'])
@permission_classes([IsAuthenticated])
def manage_teacher_groups(request, teacher_id):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    teacher = get_object_or_404(User, id=teacher_id, role='teacher')
    
    if request.method == 'GET':
        # В вашей схеме БД "закрепление преподавателя" делается через user.group_id
        groups = Group.objects.filter(id=teacher.group_id) if teacher.group_id else Group.objects.none()
        serializer = GroupSerializer(groups, many=True)
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    
    elif request.method == 'POST':
        # Добавляем/обновляем одну группу через teacher.group_id (в БД нет ManyToMany).
        group_ids = request.data.get('group_ids', [])
        group = Group.objects.filter(id__in=group_ids).first()
        teacher.group = group
        teacher.save()

        return Response({
            'status': 'success',
            'message': 'Группа преподавателя обновлена.',
            'data': GroupSerializer(teacher.group and [teacher.group] or [], many=True).data
        })
    
    elif request.method == 'PUT':
        # заменяем группу преподавателя
        serializer = TeacherGroupUpdateSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'errors': serializer.errors
            }, status=400)
        
        group_ids = serializer.validated_data['group_ids']
        group = Group.objects.filter(id__in=group_ids).first()
        teacher.group = group
        teacher.save()
        
        return Response({
            'status': 'success',
            'message': 'Группа преподавателя обновлена.',
            'data': GroupSerializer(teacher.group and [teacher.group] or [], many=True).data
        })


#группы
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_groups(request):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    groups = Group.objects.all().select_related('course', 'major')
    serializer = GroupSerializer(groups, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_group(request):
    if not _admin_only(request.user):
        return Response({'detail': 'Только для администратора'}, status=403)
    serializer = GroupCreateSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'errors': serializer.errors
        }, status=400)
    
    group = serializer.save()
    
    return Response({
        'status': 'success',
        'message': f'Группа "{group.name}" создана',
        'data': GroupSerializer(group).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_teacher_registration_requests(request):
    """Список заявок на подтверждение регистрации для текущего преподавателя."""
    teacher = request.user
    if teacher.role != 'teacher':
        return Response({'detail': 'Доступ запрещен'}, status=403)

    qs = (
        Request.objects.filter(type='student_registration_confirm')
        .select_related('user', 'user__group')
        .order_by('-id')
    )

    # Фильтр по группе преподавателя (в user есть group_id, но в group нет teacher_id).
    if teacher.group_id:
        qs = qs.filter(user__group_id=teacher.group_id)
    else:
        qs = qs.none()

    items = [
        {
            'id': r.id,
            'studentName': f'{r.user.first_name} {r.user.last_name}'.strip(),
            'date': timezone.localdate().strftime('%d.%m.%Y'),
        }
        for r in qs
    ]

    return Response({'status': 'success', 'data': items})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_teacher_registration_request(request, req_id: int):
    """Принять подтверждение студента."""
    teacher = request.user
    if teacher.role != 'teacher':
        return Response({'detail': 'Доступ запрещен'}, status=403)

    application = get_object_or_404(Request, id=req_id, type='student_registration_confirm')
    if not teacher.group_id or not application.user.group_id or application.user.group_id != teacher.group_id:
        return Response({'detail': 'Заявка не принадлежит вашему преподавателю'}, status=403)

    student = application.user
    student.is_active = True
    student.save()
    application.delete()

    return Response({'status': 'success', 'message': 'Заявка принята.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_teacher_registration_request(request, req_id: int):
    """Отклонить подтверждение студента."""
    teacher = request.user
    if teacher.role != 'teacher':
        return Response({'detail': 'Доступ запрещен'}, status=403)

    application = get_object_or_404(Request, id=req_id, type='student_registration_confirm')
    if not teacher.group_id or not application.user.group_id or application.user.group_id != teacher.group_id:
        return Response({'detail': 'Заявка не принадлежит вашему преподавателю'}, status=403)

    # Удаляем студента и заявку (для свежей регистрации без зависимостей достаточно).
    student = application.user
    application.delete()
    student.delete()

    return Response({'status': 'success', 'message': 'Заявка отклонена.'})


_SCHEDULE_DAYS_RU = (
    'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье',
)


def _canonical_group_name(raw: str):
    """Имя группы как в таблице group (связь schedule.group_name → group.name)."""
    s = (raw or '').strip()
    if not s:
        return None
    g = Group.objects.filter(name__iexact=s).first()
    return g.name if g else None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_group_options(request):
    """Все группы из БД для выбора в расписании."""
    if getattr(request.user, 'role', None) != 'teacher':
        return Response({'detail': 'Только для преподавателя'}, status=403)
    qs = Group.objects.all().order_by('name')
    return Response({'status': 'success', 'data': GroupOptionSerializer(qs, many=True).data})


def _parse_schedule_time(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ('%H:%M:%S', '%H:%M'):
        try:
            return dt.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def teacher_schedule_week(request):
    """Неделя расписания: чтение из таблицы schedule, сохранение при PUT.
    GET отдаёт все строки за интервал (пн–сб): данные БД без скрытой фильтрации.
    group_name в schedule согласован с group.name через валидацию при PUT.
    """
    user = request.user
    if getattr(user, 'role', None) != 'teacher':
        return Response({'detail': 'Только для преподавателя'}, status=403)

    if request.method == 'GET':
        ws_raw = request.query_params.get('week_start')
        if ws_raw:
            ws = parse_date(ws_raw)
        else:
            today = timezone.localdate()
            ws = today - timedelta(days=today.weekday())
        if not ws:
            return Response({'detail': 'Некорректная week_start'}, status=400)
        we = ws + timedelta(days=5)  # пн–сб

        qs = Schedule.objects.filter(lesson_date__gte=ws, lesson_date__lte=we).order_by(
            'lesson_date', 'lesson_time', 'id',
        )
        return Response({
            'status': 'success',
            'week_start': ws.isoformat(),
            'data': ScheduleEntrySerializer(qs, many=True).data,
        })

    ws = parse_date(str(request.data.get('week_start') or '')[:10])
    if not ws:
        return Response({'detail': 'Укажите week_start (YYYY-MM-DD), понедельник недели'}, status=400)
    we = ws + timedelta(days=5)
    lessons = request.data.get('lessons')
    if not isinstance(lessons, list):
        return Response({'detail': 'lessons — массив записей расписания'}, status=400)

    normalized = []
    for item in lessons:
        ld = parse_date(str(item.get('lesson_date', ''))[:10])
        if not ld or ld < ws or ld > we:
            continue
        t = _parse_schedule_time(item.get('lesson_time') if item.get('lesson_time') else item.get('time'))
        if not t:
            continue
        room = (item.get('room') or '').strip() or '-'
        room = room[:50]
        raw_group = (item.get('group_name') or item.get('group') or '').strip()
        gn = _canonical_group_name(raw_group)
        if not gn:
            return Response(
                {
                    'detail': f'Группа «{raw_group or "—"}» не найдена в базе (таблица group). Выберите из списка.',
                },
                status=400,
            )
        pk = item.get('id')
        if pk is not None and str(pk).isdigit():
            pk = int(pk)
        else:
            pk = None
        normalized.append({
            'id': pk,
            'lesson_date': ld,
            'lesson_time': t,
            'room': room,
            'group_name': gn,
            'day_of_week': _SCHEDULE_DAYS_RU[ld.weekday()],
        })

    with transaction.atomic():
        base = Schedule.objects.filter(lesson_date__gte=ws, lesson_date__lte=we)
        keep = {n['id'] for n in normalized if n['id']}
        base.exclude(id__in=keep).delete()
        for n in normalized:
            if n['id']:
                obj = Schedule.objects.filter(id=n['id']).first()
                if not obj:
                    continue
                obj.lesson_date = n['lesson_date']
                obj.lesson_time = n['lesson_time']
                obj.room = n['room']
                obj.group_name = n['group_name']
                obj.day_of_week = n['day_of_week']
                obj.save()
            else:
                Schedule.objects.create(
                    group_name=n['group_name'],
                    day_of_week=n['day_of_week'],
                    lesson_date=n['lesson_date'],
                    lesson_time=n['lesson_time'],
                    room=n['room'],
                )

    qs = Schedule.objects.filter(lesson_date__gte=ws, lesson_date__lte=we).order_by(
        'lesson_date', 'lesson_time', 'id',
    )
    return Response({
        'status': 'success',
        'message': 'Расписание сохранено',
        'week_start': ws.isoformat(),
        'data': ScheduleEntrySerializer(qs, many=True).data,
    })


def _teacher_only(user):
    return getattr(user, 'role', None) == 'teacher'


def _learning_tree_queryset():
    return Theory.objects.order_by('id').prefetch_related(
        Prefetch(
            'themes',
            queryset=Theme.objects.order_by('id').prefetch_related(
                Prefetch('materials', queryset=Material.objects.order_by('id')),
            ),
        ),
    )


def _theory_for_major_course(major: Major, course: Course) -> Theory:
    """Одна «обёрточная» теория на пару специальность + курс (для FK theme.theory)."""
    label = major_theory_bundle_label(major.id, course.number)
    th, _ = Theory.objects.get_or_create(name=label, defaults={'text': ''})
    return th


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def learning_catalog(request):
    """Учебные группы → курсы для бокового меню; материалы по major группы + выбранный курс."""
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    # В БД могут существовать несколько Course с одинаковым number (из-за тестовых/черновых данных).
    # В сайдбаре отображаем только уникальные номера курсов, чтобы не было дублей.
    courses_unique = (
        Course.objects.values('number')
        .annotate(id=Min('id'))
        .order_by('number')
    )
    course_objs = [{'id': r['id'], 'number': r['number']} for r in courses_unique]
    label_by_major = {row['id']: row['label'] for row in majors_for_learning_catalog()}
    groups = Group.objects.select_related('major').order_by('name', 'id')
    payload = []
    for g in groups:
        major = g.major
        mid = major.id if major is not None else None
        label = ''
        if mid is not None:
            label = (label_by_major.get(mid) or (major.name if major else '') or '').strip()
        payload.append({
            'id': g.id,
            'name': g.name,
            'major_id': mid,
            'major_label': label,
            'courses': list(course_objs),
        })
    return Response({'status': 'success', 'data': payload})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def learning_topics(request):
    """Темы (с материалами) для пары специальность + курс (major_id с выбранной учебной группы)."""
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    mid = request.query_params.get('major_id')
    cid = request.query_params.get('course_id')
    if not mid or not cid:
        return Response({'detail': 'Укажите major_id и course_id'}, status=400)
    themes = (
        Theme.objects.filter(major_id=mid, course_id=cid)
        .prefetch_related(Prefetch('materials', queryset=Material.objects.order_by('id')))
        .order_by('id')
    )
    return Response({
        'status': 'success',
        'data': ThemeCatalogSerializer(themes, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def learning_tree(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    theories = _learning_tree_queryset()
    return Response({
        'status': 'success',
        'data': TheoryLearningTreeSerializer(theories, many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def learning_theory_create(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'detail': 'Укажите название раздела'}, status=400)
    text = (request.data.get('text') or '').strip()
    th = Theory.objects.create(name=name, text=text)
    return Response({'status': 'success', 'data': {'id': th.id, 'name': th.name}}, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def learning_theory_detail(request, pk: int):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    theory = get_object_or_404(Theory, pk=pk)
    if request.method == 'DELETE':
        theory.delete()
        return Response({'status': 'success', 'message': 'Раздел удалён'})
    name = request.data.get('name')
    text = request.data.get('text')
    if name is not None:
        n = str(name).strip()
        if n:
            theory.name = n
    if text is not None:
        theory.text = str(text)
    theory.save()
    return Response({'status': 'success', 'data': {'id': theory.id, 'name': theory.name}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def learning_theme_create(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'detail': 'Укажите название темы'}, status=400)

    major_id = request.data.get('major_id')
    course_id = request.data.get('course_id')
    theory_id = request.data.get('theory_id')

    if major_id and course_id:
        major = get_object_or_404(Major, pk=major_id)
        course = get_object_or_404(Course, pk=course_id)
        theory = _theory_for_major_course(major, course)
        theme = Theme.objects.create(
            theory=theory, name=name, major=major, course=course,
        )
        return Response({
            'status': 'success',
            'data': {
                'id': theme.id,
                'name': theme.name,
                'theory_id': theory.id,
                'major_id': major.id,
                'course_id': course.id,
            },
        }, status=201)

    if theory_id:
        theory = get_object_or_404(Theory, pk=theory_id)
        theme = Theme.objects.create(theory=theory, name=name)
        return Response({
            'status': 'success',
            'data': {'id': theme.id, 'name': theme.name, 'theory_id': theory.id},
        }, status=201)

    return Response(
        {'detail': 'Укажите major_id и course_id или theory_id'},
        status=400,
    )


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def learning_theme_detail(request, pk: int):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    theme = get_object_or_404(Theme, pk=pk)
    if request.method == 'DELETE':
        theme.delete()
        return Response({'status': 'success', 'message': 'Тема удалена'})
    name = request.data.get('name')
    if name is not None:
        n = str(name).strip()
        if n:
            theme.name = n
    theme.save()
    return Response({'status': 'success', 'data': {'id': theme.id, 'name': theme.name}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def learning_material_create(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    theme_id = request.data.get('theme_id')
    if not theme_id:
        return Response({'detail': 'Нужен theme_id'}, status=400)
    theme = get_object_or_404(Theme, pk=theme_id)
    title = (request.data.get('title') or 'Новый материал').strip()[:200]
    mtype = (request.data.get('type') or 'text').strip()[:50] or 'text'
    url = request.data.get('url')
    description = request.data.get('description', '')
    if description is None:
        description = ''
    mat = Material.objects.create(
        theme=theme,
        title=title,
        type=mtype,
        url=str(url).strip() if url else None,
        description=str(description),
    )
    return Response({'status': 'success', 'data': MaterialNodeSerializer(mat).data}, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def learning_material_detail(request, pk: int):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    mat = get_object_or_404(Material, pk=pk)
    if request.method == 'DELETE':
        mat.delete()
        return Response({'status': 'success', 'message': 'Материал удалён'})
    if 'title' in request.data:
        t = str(request.data.get('title') or '').strip()[:200]
        if t:
            mat.title = t
    if 'type' in request.data:
        mat.type = str(request.data.get('type') or 'text').strip()[:50] or 'text'
    if 'url' in request.data:
        u = request.data.get('url')
        mat.url = str(u).strip() if u else None
    if 'description' in request.data:
        mat.description = request.data.get('description')
    mat.save()
    return Response({'status': 'success', 'data': MaterialNodeSerializer(mat).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_self_study(request):
    """Общие темы самоподготовки: `theme` без major/course, текст в `theory`. Только просмотр."""
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    qs = (
        Theme.objects.filter(major__isnull=True, course__isnull=True)
        .select_related('theory')
        .order_by('id')
    )
    return Response({
        'status': 'success',
        'data': ThemeCommonSelfStudySerializer(qs, many=True).data,
    })


DEFAULT_VEDOMOST_COLUMNS = ['Урок №1', 'Диалог', 'Урок №2', '', '']


def _student_vedomost_label(user: User) -> str:
    ln = (user.last_name or '').strip()
    fn = (user.first_name or '').strip()
    if fn:
        return f'{ln} {fn[0]}.'
    return ln or (user.username or '')


def _safe_gradebook_row(group: Group):
    try:
        return GradebookSheet.objects.filter(group=group).first()
    except DatabaseError:
        return None


def _normalize_gradebook_columns(sheet):
    if not sheet or sheet.column_titles is None:
        return list(DEFAULT_VEDOMOST_COLUMNS)
    ct = sheet.column_titles
    if isinstance(ct, list):
        out = [str(x) if x is not None else '' for x in ct]
        return out if out else list(DEFAULT_VEDOMOST_COLUMNS)
    return list(DEFAULT_VEDOMOST_COLUMNS)


def _normalize_gradebook_cells(sheet):
    if not sheet or sheet.cells is None:
        return {}
    c = sheet.cells
    if isinstance(c, dict):
        return {str(k): v for k, v in c.items()}
    return {}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gradebook_groups(request):
    """Плоский список всех учебных групп для сайдбара ведомости."""
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    groups = Group.objects.order_by('name', 'id')
    return Response({
        'status': 'success',
        'data': GroupOptionSerializer(groups, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gradebook_catalog(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)
    courses = list(Course.objects.order_by('number'))
    payload = []
    for row in majors_for_learning_catalog():
        course_payload = []
        for c in courses:
            groups = Group.objects.filter(major_id=row['id'], course_id=c.id).order_by('name')
            course_payload.append({
                'id': c.id,
                'number': c.number,
                'groups': [{'id': g.id, 'name': g.name} for g in groups],
            })
        payload.append({
            'id': row['id'],
            'name': row['name'],
            'label': row['label'],
            'short_name': row.get('short_name'),
            'courses': course_payload,
        })
    return Response({'status': 'success', 'data': payload})


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def gradebook_sheet(request):
    if not _teacher_only(request.user):
        return Response({'detail': 'Только для преподавателя'}, status=403)

    if request.method == 'GET':
        gid = request.query_params.get('group_id')
        if not gid:
            return Response({'detail': 'Укажите group_id'}, status=400)
        group = get_object_or_404(Group, pk=gid)
        students = User.objects.filter(group=group).order_by(
            'last_name', 'first_name', 'id',
        )
        sheet = _safe_gradebook_row(group)
        column_titles = _normalize_gradebook_columns(sheet)
        raw_cells = _normalize_gradebook_cells(sheet)
        student_rows = []
        for u in students:
            sid = str(u.id)
            vals = raw_cells.get(sid) or raw_cells.get(u.id) or []
            if not isinstance(vals, list):
                vals = []
            vals = [str(v) if v is not None else '' for v in vals]
            if len(vals) < len(column_titles):
                vals = vals + [''] * (len(column_titles) - len(vals))
            else:
                vals = vals[: len(column_titles)]
            student_rows.append({
                'id': u.id,
                'name': _student_vedomost_label(u),
                'values': vals,
            })
        return Response({
            'status': 'success',
            'data': {
                'group_id': group.id,
                'group_name': group.name,
                'column_titles': column_titles,
                'students': student_rows,
            },
        })

    group_id = request.data.get('group_id')
    if not group_id:
        return Response({'detail': 'Нужен group_id'}, status=400)
    group = get_object_or_404(Group, pk=group_id)
    column_titles = request.data.get('column_titles')
    cells = request.data.get('cells')
    if not isinstance(column_titles, list):
        return Response({'detail': 'column_titles должен быть массивом строк'}, status=400)
    column_titles = [str(x) if x is not None else '' for x in column_titles]
    if not isinstance(cells, dict):
        return Response({'detail': 'cells должен быть объектом'}, status=400)

    student_ids = set(
        User.objects.filter(group=group).values_list('id', flat=True),
    )
    cells_out = {}
    n = len(column_titles)
    for sid_key, vals in cells.items():
        try:
            sid = int(sid_key)
        except (TypeError, ValueError):
            return Response({'detail': f'Некорректный ключ студента: {sid_key!r}'}, status=400)
        if sid not in student_ids:
            return Response({'detail': f'Студент id={sid} не входит в эту группу'}, status=400)
        if not isinstance(vals, list):
            return Response({'detail': f'Строка оценок для студента {sid} должна быть массивом'}, status=400)
        row = [str(v) if v is not None else '' for v in vals]
        if len(row) < n:
            row = row + [''] * (n - len(row))
        else:
            row = row[:n]
        cells_out[str(sid)] = row

    for sid in student_ids:
        cells_out.setdefault(str(sid), [''] * n)

    try:
        GradebookSheet.objects.update_or_create(
            group=group,
            defaults={'column_titles': column_titles, 'cells': cells_out},
        )
    except DatabaseError:
        return Response({
            'detail': 'Таблица ведомости (gradebook_sheet) в базе отсутствует. '
                      'Выполните миграции: python manage.py migrate users',
        }, status=503)
    return Response({'status': 'success', 'message': 'Ведомость сохранена'})