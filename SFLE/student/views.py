from django.db import DatabaseError
from django.db.models import Prefetch, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from users.gradebook_schedule import gradebook_column_headers_from_schedule
from users.models import (
    User,
    Theme,
    Material,
    Test,
    Question,
    AnswerOption,
    Task,
    Attendance,
    TestResult,
    GradebookSheet,
)
from .self_study_utils import build_self_study_items
from .serializers import (
    StudentProfileSerializer, ThemeListSerializer, ThemeDetailSerializer,
    TestSerializer, AttendanceSerializer,
    ThemeCatalogSerializer,
)


_DEFAULT_GRADEBOOK_COLUMNS = ('Урок №1', 'Диалог', 'Урок №2', '', '')


def _student_progress_display_name(student: User) -> str:
    """Фамилия и имя для экрана успеваемости."""
    ln = (student.last_name or '').strip()
    fn = (student.first_name or '').strip()
    if ln and fn:
        return f'{ln} {fn}'
    if ln or fn:
        return ln or fn
    return (student.username or student.email or '').strip()


def _gradebook_row_for_student(student: User) -> dict | None:
    """Колонки ведомости группы и строка оценок текущего студента (как у преподавателя в gradebook)."""
    if not student or not getattr(student, 'group_id', None):
        return None
    group = student.group
    group_name = group.name if group else ''
    try:
        sheet = GradebookSheet.objects.filter(group_id=student.group_id).first()
    except DatabaseError:
        return {
            'group_name': group_name,
            'student_name': _student_progress_display_name(student),
            'column_titles': [],
            'values': [],
        }

    if not sheet:
        return {
            'group_name': group_name,
            'student_name': _student_progress_display_name(student),
            'column_titles': [],
            'values': [],
        }

    ct = sheet.column_titles
    if isinstance(ct, list) and ct:
        column_titles = [str(x) if x is not None else '' for x in ct]
    else:
        column_titles = list(_DEFAULT_GRADEBOOK_COLUMNS)

    column_titles = gradebook_column_headers_from_schedule(
        group, len(column_titles), column_titles,
    )

    raw_cells = sheet.cells
    cells_map: dict = {}
    if isinstance(raw_cells, dict):
        cells_map = {str(k): v for k, v in raw_cells.items()}
    sid = str(student.pk)
    vals = cells_map.get(sid) or []
    if not isinstance(vals, list):
        vals = []
    vals = [str(v) if v is not None else '' for v in vals]
    n = len(column_titles)
    if len(vals) < n:
        vals = vals + [''] * (n - len(vals))
    else:
        vals = vals[:n]

    return {
        'group_name': group_name,
        'student_name': _student_progress_display_name(student),
        'column_titles': column_titles,
        'values': vals,
    }


def _get_current_student(request):
    """Текущий авторизованный студент."""
    user = getattr(request, 'user', None)
    if (
        getattr(user, 'is_authenticated', False)
        and (getattr(user, 'role', None) or '').lower() == 'student'
        and getattr(user, 'is_active', False)
    ):
        return user
    return None


def _theme_ids_for_major_course(major_id: int, course_id: int) -> list:
    """Темы с привязкой к специальности и курсу (поля theme.major_id, theme.course_id)."""
    return list(
        Theme.objects.filter(major_id=major_id, course_id=course_id)
        .order_by('id')
        .values_list('id', flat=True)
    )


def _task_theme_filter_for_student(student: User | None) -> Q:
    """Задания только по темам учебного плана группы; общие темы — в самоподготовке."""
    if not student or not getattr(student, 'group_id', None):
        return Q(pk__in=[])
    g = student.group
    if g.major_id and g.course_id:
        return Q(theme__major_id=g.major_id, theme__course_id=g.course_id)
    return Q(pk__in=[])


def _theme_ids_for_student(student):
    """Темы учебного плана группы (major+course на теме). Общие без привязки — только в самоподготовке."""
    if not student or not student.group_id:
        return []
    group = student.group
    if not getattr(group, 'major_id', None) or not getattr(group, 'course_id', None):
        return []
    return _theme_ids_for_major_course(group.major_id, group.course_id)


#профиль студента
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    user = request.user
    if (getattr(user, 'role', None) or '').lower() != 'student':
        return Response(
            {'status': 'error', 'message': 'Профиль доступен только студентам.'},
            status=403,
        )
    student = (
        User.objects.select_related('group__major', 'group__course')
        .filter(pk=user.pk)
        .first()
    )
    if not student:
        return Response({'status': 'error', 'message': 'Пользователь не найден.'}, status=404)

    serializer = StudentProfileSerializer(student)
    return Response({'status': 'success', 'data': serializer.data})


#гл страница
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_dashboard(request):
    student = (
        User.objects.select_related('group__major', 'group__course')
        .filter(pk=request.user.pk)
        .first()
    )
    if not student or (getattr(student, 'role', None) or '').lower() != 'student':
        return Response({'status': 'error', 'message': 'Доступно только студентам.'}, status=403)

    now = timezone.now()
    current_tasks = []
    debts = []

    tasks = (
        Task.objects.filter(_task_theme_filter_for_student(student))
        .select_related('theme')
        .order_by('deadline_date', 'id')
    )
    completed_task_ids = set(
        Attendance.objects.filter(student=student, is_completed=True, task__isnull=False).values_list(
            'task_id', flat=True
        )
    )

    for task in tasks:
        if task.id in completed_task_ids:
            continue

        dl = task.deadline_date
        if dl is not None and timezone.is_naive(dl):
            dl = timezone.make_aware(dl, timezone.get_current_timezone())
        overdue = dl is not None and dl < now

        item = {
            'task_id': task.id,
            'title': task.text[:120],
            'deadline': task.deadline_date,
            'theme': task.theme.name if task.theme else '',
        }
        debt_item = {
            'type': 'task',
            'date': dl.date() if dl else None,
            'title': task.text[:120],
            'theme': task.theme.name if task.theme else '',
            'deadline': task.deadline_date,
            'task_id': task.id,
        }

        if overdue:
            debts.append(debt_item)
        else:
            current_tasks.append(item)

    return Response(
        {
            'status': 'success',
            'data': {
                'current_tasks': current_tasks,
                'debts': debts,
            },
        }
    )


#список тем/уроков
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_themes(request):
    """Получить темы уроков для курса/специальности текущего студента."""
    student = _get_current_student(request)
    if not student:
        return Response({'status': 'error', 'message': 'Студент не найден'}, status=404)
    if not student.group_id:
        return Response({'status': 'error', 'message': 'У студента не указана группа'}, status=400)

    theme_ids = _theme_ids_for_student(student)
    themes = Theme.objects.filter(id__in=theme_ids).order_by('id')
    serializer = ThemeListSerializer(themes, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


#содержимое темы
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_theme_detail(request, theme_id):
    """Детали темы: теория (theme.theory_id), файлы к теории, задания (task.theme_id), материалы (material.theme_id)."""
    student = User.objects.filter(pk=request.user.pk).first()
    if not student or (getattr(student, 'role', None) or '').lower() != 'student':
        return Response({'status': 'error', 'message': 'Студент не найден'}, status=404)
    allowed_theme_ids = set(_theme_ids_for_student(student))
    if theme_id not in allowed_theme_ids:
        return Response(
            {
                'status': 'error',
                'message': 'Тема недоступна для вашей специальности/курса',
            },
            status=403,
        )

    theme = (
        Theme.objects.select_related('theory', 'major', 'course')
        .prefetch_related(Prefetch('materials', queryset=Material.objects.order_by('id')))
        .filter(pk=theme_id)
        .first()
    )
    if theme is None:
        return Response({'status': 'error'}, status=404)
    serializer = ThemeDetailSerializer(theme)
    
    #ссылки(навигация)
    data = serializer.data
    data['api_links'] = {
        'theory': f'/api/student/themes/{theme_id}/',
        'tasks': f'/api/student/themes/{theme_id}/tasks/',
        'test': f'/api/student/themes/{theme_id}/test/'
    }
    
    return Response({
        'status': 'success',
        'data': data
    })


#получить тест
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_test(request, theme_id):
    student = _get_current_student(request)
    if not student:
        return Response({'status': 'error', 'message': 'Раздел доступен только студентам.'}, status=403)
    theme = get_object_or_404(Theme, id=theme_id)
    if theme_id not in set(_theme_ids_for_student(student)):
        return Response({'status': 'error', 'message': 'Тема недоступна для вашей группы.'}, status=403)
    test = Test.objects.filter(theme=theme).first()
    
    if not test:
        return Response({
            'status': 'error',
            'message': 'Тест не найден'
        }, status=404)
    
    serializer = TestSerializer(test)
    
    #проверка проходил ли студент этот тест
    has_passed = False
    if student:
        has_passed = TestResult.objects.filter(student=student, test=test).exists()
    
    return Response({
        'status': 'success',
        'data': serializer.data,
        'has_passed': has_passed
    })


#тест
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_test(request, theme_id):
    student = _get_current_student(request)
    
    if not student:
        return Response({
            'status': 'error',
            'message': 'Раздел доступен только студентам.'
        }, status=403)
    
    theme = get_object_or_404(Theme, id=theme_id)
    if theme_id not in set(_theme_ids_for_student(student)):
        return Response({'status': 'error', 'message': 'Тема недоступна для вашей группы.'}, status=403)
    test = Test.objects.filter(theme=theme).first()
    
    if not test:
        return Response({
            'status': 'error',
            'message': 'Тест не найден'
        }, status=404)
    
    #проверяем не проходил ли уже
    if TestResult.objects.filter(student=student, test=test).exists():
        return Response({
            'status': 'error',
            'message': 'Вы уже прошли этот тест. Повторное прохождение невозможно.'
        }, status=400)
    
    #получаем ответы из запроса
    answers = request.data.get('answers', {})
    
    # Вопросы для проверки (текущая модель не связывает вопросы напрямую с тестом).
    questions = Question.objects.filter(
        id__in=AnswerOption.objects.values_list('question', flat=True).distinct()
    )[:10]
    
    #подсчет баллов
    total_score = 0
    max_score = len(questions) * 10  #10 баллов за вопрос(поменять потом!!!!!!!!!!!)
    
    for q in questions:
        user_answer = answers.get(str(q.id), {})
        selected_option_id = user_answer.get('option_id')
        
        if selected_option_id:
            is_correct = AnswerOption.objects.filter(
                id=selected_option_id,
                question=q,
                is_correct=True
            ).exists()
            
            if is_correct:
                total_score += 10
    
    #сохр рез-т
    result = TestResult.objects.create(
        student=student,
        test=test,
        score=total_score,
        max_score=max_score
    )
    
    return Response({
        'status': 'success',
        'message': 'Тест успешно сдан!',
        'data': {
            'score': total_score,
            'max_score': max_score,
            'percentage': round((total_score / max_score * 100), 1) if max_score > 0 else 0
        }
    })


#успечаемость
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_progress(request):
    student = _get_current_student(request)
    
    if not student:
        return Response({
            'status': 'error',
            'message': 'Студент не найден'
        }, status=404)
    
    #посещаемость
    attendances = Attendance.objects.filter(student=student).order_by('-date')
    attendance_data = AttendanceSerializer(attendances, many=True).data
    
    #рез-ты тестов
    test_results = TestResult.objects.filter(student=student).select_related('test__theme')
    test_data = []
    for tr in test_results:
        test_data.append({
            'test_name': f"Тест {tr.test.number}: {tr.test.theme.name}" if tr.test.theme else f"Тест {tr.test.number}",
            'date': tr.completed_at.date(),
            'score': tr.score,
            'max_score': tr.max_score,
            'percentage': round((tr.score / tr.max_score * 100), 1) if tr.max_score > 0 else 0
        })
    
    #статус сдачи заданий
    tasks_data = []
    tasks = Task.objects.filter(
        attendances__student=student
    ).distinct()[:20]
    
    for task in tasks:
        attendance = Attendance.objects.filter(student=student, task=task).first()
        tasks_data.append({
            'task_name': task.text[:100],
            'deadline': task.deadline_date,
            'status': 'сдано' if attendance and attendance.is_completed else 'не сдано',
            'grade': None
        })

    gradebook = _gradebook_row_for_student(student)

    return Response({
        'status': 'success',
        'data': {
            'attendance': attendance_data,
            'test_results': test_data,
            'tasks': tasks_data,
            'student_display_name': _student_progress_display_name(student),
            'gradebook': gradebook,
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_learning_materials(request):
    """Темы с материалами только по специальности и курсу группы студента (без общих тем — они в самоподготовке)."""
    student = (
        User.objects.select_related('group__major', 'group__course')
        .filter(pk=request.user.pk)
        .first()
    )
    if not student or (getattr(student, 'role', None) or '').lower() != 'student':
        return Response(
            {'status': 'error', 'message': 'Раздел доступен только студентам.'},
            status=403,
        )
    if not student.group_id:
        return Response(
            {
                'status': 'error',
                'message': 'У вас не указана группа. Обратитесь к преподавателю.',
            },
            status=400,
        )
    g = student.group
    major_full = (g.major.name or '').strip() if getattr(g, 'major', None) else None
    course_num = g.course.number if getattr(g, 'course', None) is not None else None
    ctx = {
        'major_name': major_full,
        'major_id': g.major_id,
        'course_id': g.course_id,
        'course_number': course_num,
    }
    if not g.major_id or not g.course_id:
        return Response({'status': 'success', 'context': ctx, 'data': []})

    theme_ids_ordered = _theme_ids_for_major_course(g.major_id, g.course_id)
    if not theme_ids_ordered:
        return Response({'status': 'success', 'context': ctx, 'data': []})

    mat_prefetch = Prefetch('materials', queryset=Material.objects.order_by('id'))
    try:
        theme_map = {
            t.id: t
            for t in Theme.objects.filter(id__in=theme_ids_ordered)
            .select_related('major', 'course')
            .prefetch_related(mat_prefetch)
        }
        themes_ordered = [theme_map[tid] for tid in theme_ids_ordered if tid in theme_map]
        payload = ThemeCatalogSerializer(themes_ordered, many=True).data
    except (ProgrammingError, OperationalError, DatabaseError):
        theme_map = {
            t.id: t
            for t in Theme.objects.filter(id__in=theme_ids_ordered).select_related('major', 'course')
        }
        themes_ordered = [theme_map[tid] for tid in theme_ids_ordered if tid in theme_map]
        payload = []
        for t in themes_ordered:
            mj = getattr(t, 'major', None)
            cr = getattr(t, 'course', None)
            payload.append(
                {
                    'id': t.id,
                    'name': t.name,
                    'materials': [],
                    'major_id': t.major_id,
                    'course_id': t.course_id,
                    'major_name': ((mj.name or '').strip() or None) if mj and t.major_id else None,
                    'course_number': cr.number if cr is not None and t.course_id else None,
                    'is_common': t.major_id is None and t.course_id is None,
                }
            )

    return Response({
        'status': 'success',
        'context': ctx,
        'data': payload,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_self_study(request):
    """Общая самоподготовка: таблица self_study_theme + темы без привязки к специальности/курсу."""
    if (getattr(request.user, 'role', None) or '').lower() != 'student':
        return Response(
            {'status': 'error', 'message': 'Раздел доступен только студентам.'},
            status=403,
        )

    return Response({'status': 'success', 'data': build_self_study_items()})