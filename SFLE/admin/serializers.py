from rest_framework import serializers
from users.models import User, Group, Course, Major, Request, Schedule


class ScheduleEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = ['id', 'group_name', 'day_of_week', 'lesson_date', 'lesson_time', 'room']


class ApplicationSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Request
        fields = ['id', 'user', 'user_name', 'user_email', 'type', 'full_name']

    def get_user_name(self, obj):
        if obj.user_id:
            return obj.user.username
        return None

    def get_user_email(self, obj):
        if obj.user_id:
            return obj.user.email
        return obj.pending_email

    def get_full_name(self, obj):
        if obj.user_id:
            u = obj.user
            s = f'{(u.last_name or "").strip()} {(u.first_name or "").strip()}'.strip()
            return s or (u.username or u.email or '')
        return (
            f'{(obj.pending_lastname or "").strip()} {(obj.pending_firstname or "").strip()}'.strip()
            or (obj.pending_email or '')
        )


class TeacherSerializer(serializers.ModelSerializer):
    firstname = serializers.CharField(source='first_name', read_only=True)
    lastname = serializers.CharField(source='last_name', read_only=True)
    full_name = serializers.SerializerMethodField()
    groups_taught = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'firstname', 'lastname', 'full_name', 'email', 'groups_taught']
    
    def get_full_name(self, obj):
        return f"{obj.last_name} {obj.first_name}".strip()
    
    def get_groups_taught(self, obj):
        if getattr(obj, 'role', None) != 'teacher':
            return []
        tg = getattr(obj, 'teaching_groups', None)
        if tg is not None and tg.exists():
            return [{'id': g.id, 'name': g.name} for g in tg.order_by('name', 'id')]
        if getattr(obj, 'group', None):
            return [{'id': obj.group.id, 'name': obj.group.name}]
        return []


class GroupSerializer(serializers.ModelSerializer):
    course_number = serializers.IntegerField(source='course.number', read_only=True)
    major_name = serializers.CharField(source='major.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'course', 'course_number', 'major', 'major_name', 'teacher_name']
    
    def get_teacher_name(self, obj):
        teacher = User.objects.filter(role='teacher', group=obj).first()
        if not teacher:
            teacher = User.objects.filter(role='teacher', teaching_groups=obj).first()
        if teacher:
            return f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username
        return None


class GroupOptionSerializer(serializers.ModelSerializer):
    """Справочник групп для выпадающих списков (id + name из таблицы group)."""

    class Meta:
        model = Group
        fields = ['id', 'name']


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name', 'course', 'major']


class MajorCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Major
        fields = ['name']


class TeacherGroupUpdateSerializer(serializers.Serializer):
    group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=True,
    )