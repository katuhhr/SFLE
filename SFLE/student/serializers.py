from rest_framework import serializers
from users.models import (
    User, Theme, Theory, Material, Test, Question, AnswerOption, SelfStudyTheme, Task, Attendance,
)


class MaterialNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ['id', 'title', 'type', 'url', 'description', 'created_at']


class ThemeWithMaterialsSerializer(serializers.ModelSerializer):
    materials = MaterialNodeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'name', 'materials']


class TheoryLearningTreeSerializer(serializers.ModelSerializer):
    themes = ThemeWithMaterialsSerializer(many=True, read_only=True)

    class Meta:
        model = Theory
        fields = ['id', 'name', 'themes']


class ThemeCatalogSerializer(serializers.ModelSerializer):
    """Тема с материалами для каталога «специальность + курс»."""
    materials = MaterialNodeSerializer(many=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'name', 'materials', 'major_id', 'course_id']


class StudentProfileSerializer(serializers.ModelSerializer):
    firstname = serializers.CharField(source='first_name', read_only=True)
    lastname = serializers.CharField(source='last_name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'firstname', 'lastname', 'full_name', 'email', 'group', 'group_name']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"


class ThemeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = ['id', 'name']


class ThemeDetailSerializer(serializers.ModelSerializer):
    theory = serializers.SerializerMethodField()
    
    class Meta:
        model = Theme
        fields = ['id', 'name', 'theory']
    
    def get_theory(self, obj):
        if obj.theory:
            return {
                'id': obj.theory.id,
                'title': obj.theory.name,
                'content': obj.theory.text
            }
        return None


class QuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'text_type', 'options']
    
    def get_options(self, obj):
        return [{'id': opt.id, 'text': opt.text} for opt in obj.answer_options.all()]


class TestSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    
    class Meta:
        model = Test
        fields = ['id', 'number', 'title', 'questions']
    
    def get_title(self, obj):
        return obj.text
    
    def get_questions(self, obj):
        # Получаем вопросы, связанные с этим тестом
        # В твоей модели нужно настроить связь Test -> Question
        # Пока используем связь через theme
        questions = Question.objects.filter(
            id__in=AnswerOption.objects.values_list('question', flat=True).distinct()
        )[:10]
        return QuestionSerializer(questions, many=True).data


class AttendanceSerializer(serializers.ModelSerializer):
    date_str = serializers.DateField(source='date', format='%Y-%m-%d')
    
    class Meta:
        model = Attendance
        fields = ['date_str', 'is_came', 'is_completed']


class TestResultSerializer(serializers.Serializer):
    test_name = serializers.CharField()
    date = serializers.DateField()
    score = serializers.IntegerField()
    max_score = serializers.IntegerField()
    percentage = serializers.FloatField()


class TaskStatusSerializer(serializers.Serializer):
    task_name = serializers.CharField()
    deadline = serializers.DateTimeField()
    status = serializers.CharField()  # 'submitted', 'not_submitted', 'checked'
    grade = serializers.IntegerField(allow_null=True)


class SelfStudySerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='theory.name')
    content = serializers.CharField(source='theory.text')
    
    class Meta:
        model = SelfStudyTheme
        fields = ['id', 'title', 'content']


class ThemeCommonSelfStudySerializer(serializers.ModelSerializer):
    """Общие темы: запись `theme` без специальности и курса; текст из `theory`."""

    title = serializers.CharField(source='name')
    content = serializers.CharField(source='theory.text', allow_blank=True, read_only=True)

    class Meta:
        model = Theme
        fields = ['id', 'title', 'content']


class DashboardSerializer(serializers.Serializer):
    current_tasks = serializers.ListField()
    debts = serializers.ListField()