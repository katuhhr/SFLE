from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import make_password
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
        #обновляем роль пользователя
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
    #пока просто удаляем заявку
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
        groups = teacher.groups_taught.all()
        serializer = GroupSerializer(groups, many=True)
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    
    elif request.method == 'POST':
        #добавить группы
        group_ids = request.data.get('group_ids', [])
        groups = Group.objects.filter(id__in=group_ids)
        teacher.groups_taught.add(*groups)
        
        return Response({
            'status': 'success',
            'message': f'Добавлено групп: {len(groups)}',
            'data': GroupSerializer(teacher.groups_taught.all(), many=True).data
        })
    
    elif request.method == 'PUT':
        #заменить все группы
        serializer = TeacherGroupUpdateSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'errors': serializer.errors
            }, status=400)
        
        group_ids = serializer.validated_data['group_ids']
        groups = Group.objects.filter(id__in=group_ids)
        teacher.groups_taught.set(groups)
        
        return Response({
            'status': 'success',
            'message': f'Группы обновлены. Теперь {len(groups)} групп',
            'data': GroupSerializer(teacher.groups_taught.all(), many=True).data
        })


#группы
@api_view(['GET'])
def get_groups(request):
    groups = Group.objects.all().select_related('course', 'major', 'teacher')
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