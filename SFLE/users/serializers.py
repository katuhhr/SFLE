from rest_framework import serializers
from users.models import User, Group, Course, Major, Request

class TeacherApplicationSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Request
        fields = ['id', 'user', 'user_name', 'user_email', 'type']


class TeacherListSerializer(serializers.ModelSerializer):
    firstname = serializers.CharField(source='first_name', read_only=True)
    lastname = serializers.CharField(source='last_name', read_only=True)
    full_name = serializers.SerializerMethodField()
    groups_taught_names = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'firstname', 'lastname', 'full_name', 'email', 'groups_taught_names']
    
    def get_full_name(self, obj):
        return f"{obj.last_name} {obj.first_name}".strip() or obj.username

    def get_groups_taught_names(self, obj):
        # В вашей схеме БД нет group.teacher_id, поэтому считаем,
        # что преподаватель "закреплён" за своей user.group_id.
        return [obj.group.name] if getattr(obj, 'group', None) else []


class GroupSerializer(serializers.ModelSerializer):
    course_number = serializers.IntegerField(source='course.number', read_only=True)
    major_name = serializers.CharField(source='major.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'course', 'course_number', 'major', 'major_name', 
                  'teacher_name']
    
    def get_teacher_name(self, obj):
        teacher = User.objects.filter(role='teacher', group=obj).first()
        if teacher:
            return f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username
        return "Не назначен"


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name', 'course', 'major']
