from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from users.models import User, Theme, Test, Question, AnswerOption, SelfStudyTheme, Task, Attendance, TestResult
from .serializers import (
    StudentProfileSerializer, ThemeListSerializer, ThemeDetailSerializer,
    TestSerializer, AttendanceSerializer, SelfStudySerializer, DashboardSerializer
)


#профиль студента
@api_view(['GET'])
def get_profile(request):
    student = User.objects.filter(role='student').first()
    
    if not student:
        return Response({
            'status': 'error',
            'message': 'Студент не найден. Создайте студента через админку.'
        }, status=404)
    
    serializer = StudentProfileSerializer(student)
    return Response({
        'status': 'success',
        'data': serializer.data
    })


#гл страница
@api_view(['GET'])
def get_dashboard(request):
    student = User.objects.filter(role='student').first()
    
    if not student:
        return Response({
            'status': 'error',
            'message': 'Студент не найден'
        }, status=404)
    
    today = timezone.now().date()
    current_tasks = []
    debts = []
    
    #текущее задание
    if student.group:
        tasks = Task.objects.filter(
            theme__theory__isnull=False
        ).order_by('deadline_date')
        
        for task in tasks:
            #проверяем, выполнено ли задание
            attendance = Attendance.objects.filter(
                student=student, 
                task=task,
                is_completed=True
            ).first()
            
            if not attendance and task.deadline_date.date() >= today:
                current_tasks.append({
                    'task_id': task.id,
                    'title': task.text[:100],
                    'deadline': task.deadline_date,
                    'theme': task.theme.name if task.theme else ''
                })
                break  #берем ближайшее
    
    #долги
    #просроченные задания
    overdue_tasks = Task.objects.filter(
        deadline_date__lt=today
    ).order_by('-deadline_date')
    
    for task in overdue_tasks:
        attendance = Attendance.objects.filter(student=student, task=task).first()
        if not attendance or not attendance.is_completed:
            debts.append({
                'type': 'task',
                'date': task.deadline_date.date(),
                'title': f'Просрочено задание: {task.text[:50]}',
                'theme': task.theme.name if task.theme else ''
            })
    
    #пропуски занятий
    missed_attendance = Attendance.objects.filter(
        student=student,
        is_came=False,
        date__lt=today
    )
    
    for att in missed_attendance:
        debts.append({
            'type': 'attendance',
            'date': att.date,
            'title': f'Пропуск занятия {att.date}',
            'theme': ''
        })
    
    #непройденные тесты (если тест был, но студент его не прошел)
    # TODO: добавить логику проверки тестов
    
    return Response({
        'status': 'success',
        'data': {
            'current_tasks': current_tasks,
            'debts': debts
        }
    })


#список тем/уроков
@api_view(['GET'])
def get_themes(request):
    """Получить список всех тем уроков"""
    themes = Theme.objects.all().order_by('id')
    serializer = ThemeListSerializer(themes, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


#содержимое темы
@api_view(['GET'])
def get_theme_detail(request, theme_id):
    """Получить детали темы: теория, ссылки на задания и тест"""
    theme = get_object_or_404(Theme, id=theme_id)
    serializer = ThemeDetailSerializer(theme)
    
    #ссылки(навигация)
    data = serializer.data
    data['links'] = {
        'theory': f'/api/student/themes/{theme_id}/',
        'tasks': f'/api/student/themes/{theme_id}/tasks/',
        'test': f'/api/student/themes/{theme_id}/test/'
    }
    
    return Response({
        'status': 'success',
        'data': data
    })


#задания по теме
@api_view(['GET'])
def get_theme_tasks(request, theme_id):
    """Получить список заданий по теме с сортировкой по дедлайну"""
    theme = get_object_or_404(Theme, id=theme_id)
    tasks_qs = Task.objects.filter(theme=theme).order_by('deadline_date')

    tasks = [{
        'id': t.id,
        'text': t.text,
        'deadline': t.deadline_date
    } for t in tasks_qs]

    return Response({
        'status': 'success',
        'data': {
            'theme': {'id': theme.id, 'name': theme.name},
            'tasks': tasks
        }
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
    student = User.objects.filter(role='student').first()
    
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
        attendance__student=student
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

#самоподготовка
@api_view(['GET'])
def get_self_study(request):
    materials = SelfStudyTheme.objects.all().select_related('theory')
    serializer = SelfStudySerializer(materials, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })