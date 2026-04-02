from rest_framework import serializers
from users.models import User, Group, Course, Major, Request

class ApplicationSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Request
        fields = ['id', 'user', 'user_name', 'user_email', 'type']


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    groups_taught = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'firstname', 'lastname', 'full_name', 'email', 'groups_taught']
    
    def get_full_name(self, obj):
        return f"{obj.firstname} {obj.lastname}"
    
    def get_groups_taught(self, obj):
        # В вашей схеме БД нет FK "group.teacher_id".
        # Поэтому считаем, что преподаватель "закреплён" за своей group_id.
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
        if teacher:
            return f"{teacher.firstname} {teacher.lastname}".strip() or teacher.username
        return None


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name', 'course', 'major']


class TeacherGroupUpdateSerializer(serializers.Serializer):
    group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )