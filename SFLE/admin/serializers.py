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
        return [{'id': g.id, 'name': g.name} for g in obj.groups_taught.all()]


class GroupSerializer(serializers.ModelSerializer):
    course_number = serializers.IntegerField(source='course.number', read_only=True)
    major_name = serializers.CharField(source='major.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'course', 'course_number', 'major', 'major_name', 'teacher', 'teacher_name']
    
    def get_teacher_name(self, obj):
        if obj.teacher:
            return f"{obj.teacher.firstname} {obj.teacher.lastname}"
        return None


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name', 'course', 'major', 'teacher']


class TeacherGroupUpdateSerializer(serializers.Serializer):
    group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )