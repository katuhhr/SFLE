from django.db.models import Prefetch, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from users.models import (
    User,
    Theme,
    Theory,
    Material,
    Test,
    Question,
    AnswerOption,
    Task,
    Attendance,
    TestResult,
    SelfStudyTheme,
)
from django.db import connection
from .serializers import (
    StudentProfileSerializer, ThemeListSerializer, ThemeDetailSerializer,
    TestSerializer, AttendanceSerializer, DashboardSerializer,
    TheoryLearningTreeSerializer, ThemeCatalogSerializer,
    ThemeCommonSelfStudySerializer,
)


def _get_current_student(request):
    """Use authenticated student if possible, fallback for compatibility."""
    user = getattr(request, 'user', None)
    if getattr(user, 'is_authenticated', False) and getattr(user, 'role', None) == 'student':
        return user
    return User.objects.filter(role='student', is_active=True).first()


def _task_theme_filter_for_student(student: User | None) -> Q:
    """Задания из тем по специальности/курсу группы и из общих тем (без major/course)."""
    if not student or not getattr(student, 'group_id', None):
        return Q(pk__in=[])
    g = student.group
    common = Q(theme__major_id__isnull=True, theme__course_id__isnull=True)
    if g.major_id and g.course_id:
        return Q(theme__major_id=g.major_id, theme__course_id=g.course_id) | common
    return common


def _theme_ids_for_student(student):
    """Filter themes by student's major+course."""
    if not student or not student.group_id:
        return []

    group = student.group
    if not getattr(group, 'major_id', None) or not getattr(group, 'course_id', None):
        return []

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT t.id
            FROM theme t
            WHERE t.major_id = %s AND t.course_id = %s
            ORDER BY t.id
            """,
            [group.major_id, group.course_id],
        )
        rows = cursor.fetchall()
    return [row[0] for row in rows]


#профиль студента
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    user = request.user
    if getattr(user, 'role', None) != 'student':
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
    if not student or getattr(student, 'role', None) != 'student':
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
def get_theme_detail(request, theme_id):
    """Получить детали темы: теория, ссылки на задания и тест"""
    student = _get_current_student(request)
    if not student:
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

    theme = get_object_or_404(Theme, id=theme_id)
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
def get_test(request, theme_id):
    student = User.objects.filter(role='student').first()
    theme = get_object_or_404(Theme, id=theme_id)
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
def submit_test(request, theme_id):
    student = User.objects.filter(role='student').first()
    
    if not student:
        return Response({
            'status': 'error',
            'message': 'Студент не найден'
        }, status=404)
    
    theme = get_object_or_404(Theme, id=theme_id)
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
    
    #получаем вопросы (временно берем первые 10)
    questions = Question.objects.all()[:10]
    
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
    
    return Response({
        'status': 'success',
        'data': {
            'attendance': attendance_data,
            'test_results': test_data,
            'tasks': tasks_data
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_learning_materials(request):
    """Темы с материалами только по специальности и курсу группы текущего студента (данные из БД)."""
    student = (
        User.objects.select_related('group__major', 'group__course')
        .filter(pk=request.user.pk)
        .first()
    )
    if not student or getattr(student, 'role', None) != 'student':
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
    if not g.major_id or not g.course_id:
        return Response(
            {
                'status': 'error',
                'message': 'У группы не заданы специальность или курс.',
            },
            status=400,
        )

    mat_prefetch = Prefetch('materials', queryset=Material.objects.order_by('id'))
    themes = (
        Theme.objects.filter(major_id=g.major_id, course_id=g.course_id)
        .select_related('major', 'course')
        .prefetch_related(mat_prefetch)
        .order_by('id')
    )
    major_full = (g.major.name or '').strip() if getattr(g, 'major', None) else None

    ctx = {
        'major_name': major_full,
        'major_id': g.major_id,
        'course_id': g.course_id,
    }
    return Response({
        'status': 'success',
        'context': ctx,
        'data': ThemeCatalogSerializer(themes, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_self_study(request):
    """Общая самоподготовка: таблица self_study_theme + темы без привязки к специальности/курсу."""
    if getattr(request.user, 'role', None) != 'student':
        return Response(
            {'status': 'error', 'message': 'Раздел доступен только студентам.'},
            status=403,
        )

    items: list[dict] = []
    theory_ids: set[int] = set()

    for sst in SelfStudyTheme.objects.select_related('theory').order_by('id'):
        th = sst.theory
        theory_ids.add(th.id)
        items.append(
            {
                'id': sst.id,
                'kind': 'self_study',
                'title': th.name,
                'content': th.text or '',
            }
        )

    for theme in (
        Theme.objects.filter(major_id__isnull=True, course_id__isnull=True)
        .select_related('theory')
        .order_by('id')
    ):
        if not theme.theory_id or theme.theory_id in theory_ids:
            continue
        th = theme.theory
        theory_ids.add(th.id)
        items.append(
            {
                'id': theme.id,
                'kind': 'common_theme',
                'title': theme.name,
                'content': (th.text or '') if th else '',
            }
        )

    return Response({'status': 'success', 'data': items})