from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from users.models import Group, User, Request, UserTeachingGroup


def _sync_teacher_group_links_for_group(group) -> None:
    """Добавляет строки в user_teaching_groups для преподов с legacy group_id = эта группа.

    Так заявки студентов видны и тем, у кого в БД заполнено только поле user.group_id
    (без строк в M2M), и список совпадает с логикой «кто ведёт группу» в админке.
    """
    if group is None:
        return
    teacher_ids = User.objects.filter(role__iexact='teacher', group_id=group.id).values_list(
        'id', flat=True
    )
    for tid in teacher_ids:
        UserTeachingGroup.objects.get_or_create(user_id=tid, group_id=group.id)


@api_view(['GET'])
@permission_classes([AllowAny])
def register_group_options(request):
    """Список групп для регистрации студента (без авторизации)."""
    qs = Group.objects.select_related('major', 'course').order_by('major_id', 'course_id', 'name')
    data = [
        {
            'id': g.id,
            'name': g.name,
            'label': f'{g.name} — {g.major.name}, {g.course.number} курс',
        }
        for g in qs
    ]
    return Response({'status': 'success', 'data': data})


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow JWT login by email for frontend auth form."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace default username input with email for API contract.
        self.fields.pop("username", None)
        self.fields["email"] = serializers.EmailField(required=True, write_only=True)

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        password = attrs.get("password")
        if not email or not password:
            raise serializers.ValidationError({"detail": "Укажите email и пароль."})

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError({"detail": "Пользователь с таким email не найден."})

        # SimpleJWT authenticates through USERNAME_FIELD, so pass username explicitly.
        token_data = super().validate({"username": user.username, "password": password})
        token_data["role"] = user.role
        token_data["email"] = user.email
        return token_data


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Регистрация студента/преподавателя.
    Студент: создаётся неактивный user с выбранной группой и заявка преподавателю;
    после одобрения преподаватель активирует аккаунт (вход, ведомость и т.д.).
    Преподаватель: неактивен до одобрения администратором.
    """
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    full_name = (request.data.get('full_name') or '').strip()
    role = (request.data.get('role') or 'student').strip().lower()
    group_name = (request.data.get('group_name') or '').strip()
    raw_group_id = request.data.get('group_id')

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
        group = None
        if raw_group_id is not None and str(raw_group_id).strip() != '':
            try:
                gid = int(raw_group_id)
            except (TypeError, ValueError):
                return Response({'detail': 'Некорректный идентификатор группы.'}, status=400)
            group = Group.objects.filter(id=gid).first()
            if not group:
                return Response({'detail': 'Выбранная группа не найдена. Обновите страницу и выберите снова.'}, status=400)
        elif group_name:
            group = Group.objects.filter(name__iexact=group_name).first()
            if not group:
                return Response(
                    {
                        'detail': 'Группа с таким названием не найдена в базе. '
                        'Проверьте написание или обратитесь к администратору.',
                    },
                    status=400,
                )
        else:
            return Response({'detail': 'Выберите группу из списка.'}, status=400)

    is_active = False

    try:
        with transaction.atomic():
            if django_role == 'student':
                user = User(
                    username=email,
                    email=email,
                    last_name=lastname,
                    first_name=firstname,
                    role='student',
                    group=group,
                    is_active=False,
                )
                user.password = make_password(password)
                user.full_clean()
                user.save()
                Request.objects.create(user=user, type='student_registration_confirm')
                _sync_teacher_group_links_for_group(group)
            else:
                user = User(
                    username=email,
                    email=email,
                    last_name=lastname,
                    first_name=firstname,
                    role=django_role,
                    group=None,
                    is_active=is_active,
                )
                user.password = make_password(password)
                user.full_clean()
                user.save()
                Request.objects.create(user=user, type='teacher_registration_confirm')
    except ValidationError as e:
        msgs = []
        if hasattr(e, 'message_dict') and e.message_dict:
            for v in e.message_dict.values():
                msgs.extend(v if isinstance(v, list) else [str(v)])
        else:
            msgs = list(getattr(e, 'messages', []) or [str(e)])
        return Response({'detail': ' '.join(str(m) for m in msgs) or 'Проверьте введённые данные.'}, status=400)
    except IntegrityError:
        return Response({'detail': 'Пользователь с таким email уже зарегистрирован.'}, status=400)

    return Response(
        {
            'status': 'success',
            'message': 'Регистрация прошла успешно.',
            'role': django_role,
            'pending': True,
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
            'full_name': f'{u.lastname} {u.firstname}'.strip(),
            'group': group_name,
            'is_active': u.is_active,
            # время ответа — полезно для фронта/отладки
            'server_date': timezone.localdate().isoformat(),
        }
    )


class EmailAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """В поле `username` можно передать email — ищем пользователя и подставляем `username`."""

    def validate(self, attrs):
        login = attrs.get('username') or ''
        if login and '@' in str(login):
            u = User.objects.filter(email__iexact=str(login).strip()).first()
            if u is not None:
                attrs['username'] = u.username
        return super().validate(attrs)


class EmailAwareTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailAwareTokenObtainPairSerializer
