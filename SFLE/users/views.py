from django.contrib.auth.hashers import make_password
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.models import Group, User, Request


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Регистрация студента/преподавателя.
    Для студента создаём заявку на подтверждение преподавателем его группы (user.is_active = False пока не подтверждено).
    """
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    full_name = (request.data.get('full_name') or '').strip()
    role = (request.data.get('role') or 'student').strip().lower()
    group_name = (request.data.get('group_name') or '').strip()

    if not email or not password:
        return Response({'detail': 'Укажите email и пароль.'}, status=400)
    if len(password) < 6:
        return Response({'detail': 'Пароль не короче 6 символов.'}, status=400)
    if User.objects.filter(username__iexact=email).exists():
        return Response({'detail': 'Пользователь с таким email уже зарегистрирован.'}, status=400)

    parts = full_name.split()
    if len(parts) >= 2:
        lastname, firstname = parts[0], ' '.join(parts[1:])
    elif len(parts) == 1:
        lastname, firstname = parts[0], ''
    else:
        lastname, firstname = 'Пользователь', ''

    django_role = 'teacher' if role == 'teacher' else 'student'
    group = None
    if django_role == 'student':
        if not group_name:
            return Response({'detail': 'Укажите номер группы.'}, status=400)
        group = Group.objects.filter(name__iexact=group_name).first()
        if not group:
            return Response(
                {
                    'detail': 'Группа с таким названием не найдена в базе. '
                    'Проверьте написание или обратитесь к администратору.',
                },
                status=400,
            )

    # Студент до подтверждения преподавателем будет неактивен
    is_active = True if django_role == 'teacher' else False

    user = User(
        username=email,
        email=email,
        lastname=lastname,
        firstname=firstname,
        role=django_role,
        group=group,
        is_active=is_active,
    )
    user.password = make_password(password)
    user.save()

    # Для студента создаём заявку преподавателю его группы
    if django_role == 'student':
        # type можно потом расширять; сейчас достаточно уникального значения
        Request.objects.create(user=user, type='student_registration_confirm')

    return Response(
        {
            'status': 'success',
            'message': 'Регистрация прошла успешно.',
            'role': django_role,
            'pending': django_role == 'student',
        },
        status=201,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Текущий пользователь (для редиректов в UI)."""
    u = request.user
    group_name = u.group.name if getattr(u, 'group', None) else None
    return Response(
        {
            'id': u.id,
            'role': u.role,
            'login': u.username,
            'firstname': u.firstname,
            'lastname': u.lastname,
            'full_name': f'{u.firstname} {u.lastname}'.strip(),
            'group': group_name,
            'is_active': u.is_active,
            # время ответа — полезно для фронта/отладки
            'server_date': timezone.localdate().isoformat(),
        }
    )
