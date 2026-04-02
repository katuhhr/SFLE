from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from users.models import User, Group, Request
from .serializers import (
    ApplicationSerializer, TeacherSerializer, GroupSerializer,
    GroupCreateSerializer, TeacherGroupUpdateSerializer
)

#заявки преподов
@api_view(['GET'])
def get_applications(request):
    applications = Request.objects.all().order_by('-id')
    serializer = ApplicationSerializer(applications, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['GET'])
def get_application_detail(request, app_id):
    application = get_object_or_404(Request, id=app_id)
    serializer = ApplicationSerializer(application)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['POST'])
def approve_application(request, app_id):
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
def reject_application(request, app_id):
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
def get_teachers(request):
    teachers = User.objects.filter(role='teacher')
    serializer = TeacherSerializer(teachers, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['GET'])
def get_teacher_detail(request, teacher_id):
    teacher = get_object_or_404(User, id=teacher_id, role='teacher')
    serializer = TeacherSerializer(teacher)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['GET', 'POST', 'PUT'])
def manage_teacher_groups(request, teacher_id):
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
def get_groups(request):
    groups = Group.objects.all().select_related('course', 'major')
    serializer = GroupSerializer(groups, many=True)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['POST'])
def create_group(request):
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
            'studentName': f'{r.user.firstname} {r.user.lastname}'.strip(),
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