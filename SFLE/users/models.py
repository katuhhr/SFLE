# users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Студент'),
        ('teacher', 'Преподаватель'),
        ('admin', 'Администратор'),
        ('predpolagatel', 'Предполагатель'),
    ]
    
    username = models.CharField(max_length=100, unique=True, verbose_name='Логин')
    lastname = models.CharField(max_length=100, verbose_name='Фамилия')
    firstname = models.CharField(max_length=100, verbose_name='Имя')
    password = models.CharField(max_length=200, verbose_name='Пароль')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, verbose_name='Роль')
    
    group = models.ForeignKey('Group', on_delete=models.SET_NULL, null=True, blank=True, 
                              related_name='students', verbose_name='Группа')
    
    class Meta:
        db_table = 'user'
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
    
    def __str__(self):
        return f"{self.firstname} {self.lastname} ({self.get_role_display()})"
    
    def is_student(self):
        return self.role == 'student'
    
    def is_teacher(self):
        return self.role == 'teacher'
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_predpolagatel(self):
        return self.role == 'predpolagatel'
    
    def get_role_display(self):
        return dict(self.ROLE_CHOICES).get(self.role, self.role)


class Group(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, verbose_name='Название группы')
    course = models.ForeignKey('Course', on_delete=models.CASCADE, related_name='groups', verbose_name='Курс')
    major = models.ForeignKey('Major', on_delete=models.CASCADE, related_name='groups', verbose_name='Специальность')
    
    class Meta:
        db_table = 'group'
        verbose_name = 'Группа'
        verbose_name_plural = 'Группы'
    
    def __str__(self):
        return self.name


class Course(models.Model):
    id = models.AutoField(primary_key=True)
    number = models.IntegerField(verbose_name='Номер курса')
    
    class Meta:
        db_table = 'course'
        verbose_name = 'Курс'
        verbose_name_plural = 'Курсы'
    
    def __str__(self):
        return f"{self.number} курс"


class Major(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, verbose_name='Название специальности')
    
    class Meta:
        db_table = 'major'
        verbose_name = 'Специальность'
        verbose_name_plural = 'Специальности'
    
    def __str__(self):
        return self.name


class Schedule(models.Model):
    id = models.AutoField(primary_key=True)
    start_couple_time = models.DateTimeField(verbose_name='Начало пары')
    end_couple_time = models.DateTimeField(verbose_name='Конец пары')
    name = models.CharField(max_length=200, verbose_name='Название')
    cabinet = models.CharField(max_length=100, verbose_name='Кабинет')
    groups = models.ManyToManyField(Group, through='ScheduleToGroup', related_name='schedules', verbose_name='Группы')
    
    class Meta:
        db_table = 'schedule'
        verbose_name = 'Расписание'
        verbose_name_plural = 'Расписания'
    
    def __str__(self):
        return f"{self.name} - {self.start_couple_time}"


class ScheduleToGroup(models.Model):
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'schedule_to_group'
        unique_together = [['schedule', 'group']]


class Theory(models.Model):
    id = models.AutoField(primary_key=True)
    text = models.TextField(verbose_name='Текст')
    name = models.CharField(max_length=200, verbose_name='Название')
    files = models.ManyToManyField('File', through='TheoryToFile', related_name='theories', verbose_name='Файлы')
    
    class Meta:
        db_table = 'theory'
        verbose_name = 'Теория'
        verbose_name_plural = 'Теории'
    
    def __str__(self):
        return self.name


class TheoryToFile(models.Model):
    theory = models.ForeignKey(Theory, on_delete=models.CASCADE)
    file = models.ForeignKey('File', on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'theory_to_file'
        unique_together = [['theory', 'file']]


class SelfStudyTheme(models.Model):
    id = models.AutoField(primary_key=True)
    theory = models.ForeignKey(Theory, on_delete=models.CASCADE, related_name='self_study_themes', verbose_name='Теория')
    
    class Meta:
        db_table = 'self_study_theme'
        verbose_name = 'Тема самоподготовки'
        verbose_name_plural = 'Темы самоподготовки'
    
    def __str__(self):
        return f"Тема самоподготовки к {self.theory.name}"


class File(models.Model):
    id = models.AutoField(primary_key=True)
    storage_url = models.CharField(max_length=500, verbose_name='URL хранения')
    name = models.CharField(max_length=200, verbose_name='Название')
    type = models.CharField(max_length=50, verbose_name='Тип файла')
    
    class Meta:
        db_table = 'file'
        verbose_name = 'Файл'
        verbose_name_plural = 'Файлы'
    
    def __str__(self):
        return self.name


class Question(models.Model):
    TEXT_TYPE_CHOICES = [
        ('single_choice', 'Одиночный выбор'),
        ('multiple_choice', 'Множественный выбор'),
        ('text', 'Письменный ответ'),
    ]
    
    id = models.AutoField(primary_key=True)
    text = models.TextField(verbose_name='Текст вопроса')
    text_type = models.CharField(max_length=50, choices=TEXT_TYPE_CHOICES, verbose_name='Тип вопроса')
    files = models.ManyToManyField(File, through='QuestionToFile', related_name='questions', verbose_name='Файлы')
    
    class Meta:
        db_table = 'question'
        verbose_name = 'Вопрос'
        verbose_name_plural = 'Вопросы'
    
    def __str__(self):
        return self.text[:100]


class QuestionToFile(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    file = models.ForeignKey(File, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'question_to_file'
        unique_together = [['question', 'file']]


class AnswerOption(models.Model):
    id = models.AutoField(primary_key=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answer_options', verbose_name='Вопрос')
    text = models.TextField(verbose_name='Текст ответа')
    is_correct = models.BooleanField(default=False, verbose_name='Правильный')
    
    class Meta:
        db_table = 'answer_option'
        verbose_name = 'Вариант ответа'
        verbose_name_plural = 'Варианты ответов'
    
    def __str__(self):
        return self.text[:100]


class StudentAnswer(models.Model):
    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='answers',
                                limit_choices_to={'role': 'student'}, verbose_name='Студент')
    answer_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE, 
                                      related_name='student_answers', verbose_name='Вариант ответа')
    
    class Meta:
        db_table = 'student_answer'
        verbose_name = 'Ответ студента'
        verbose_name_plural = 'Ответы студентов'
    
    def __str__(self):
        return f"{self.student} - {self.answer_option}"


class Request(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requests', verbose_name='Пользователь')
    type = models.CharField(max_length=100, verbose_name='Тип заявки')
    
    class Meta:
        db_table = 'request'
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'
    
    def __str__(self):
        return f"{self.user} - {self.type}"


class Attendance(models.Model):
    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances',
                                limit_choices_to={'role': 'student'}, verbose_name='Студент')
    date = models.DateField(verbose_name='Дата')
    is_came = models.BooleanField(default=False, verbose_name='Пришел')
    is_completed = models.BooleanField(default=False, verbose_name='Выполнил')
    task = models.ForeignKey('Task', on_delete=models.CASCADE, null=True, blank=True, 
                             related_name='attendances', verbose_name='Задание')
    
    class Meta:
        db_table = 'attendance'
        verbose_name = 'Посещаемость'
        verbose_name_plural = 'Посещаемость'
        unique_together = [['student', 'date']]
    
    def __str__(self):
        return f"{self.student} - {self.date}"


class Task(models.Model):
    id = models.AutoField(primary_key=True)
    theme = models.ForeignKey('Theme', on_delete=models.CASCADE, related_name='tasks', verbose_name='Тема')
    text = models.TextField(verbose_name='Текст задания')
    deadline_date = models.DateTimeField(verbose_name='Дедлайн')
    
    class Meta:
        db_table = 'task'
        verbose_name = 'Задание'
        verbose_name_plural = 'Задания'
    
    def __str__(self):
        return self.text[:100]


class TestResult(models.Model):
    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_results',
                                limit_choices_to={'role': 'student'}, verbose_name='Студент')
    test = models.ForeignKey('Test', on_delete=models.CASCADE, related_name='results', verbose_name='Тест')
    score = models.IntegerField(verbose_name='Баллы')
    max_score = models.IntegerField(verbose_name='Максимальный балл')
    completed_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата прохождения')
    
    class Meta:
        unique_together = ['student', 'test']


class Theme(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, verbose_name='Название')
    theory = models.ForeignKey(Theory, on_delete=models.CASCADE, related_name='themes', verbose_name='Теория')
    
    class Meta:
        db_table = 'theme'
        verbose_name = 'Тема'
        verbose_name_plural = 'Темы'
    
    def __str__(self):
        return self.name


class Test(models.Model):
    id = models.AutoField(primary_key=True)
    number = models.IntegerField(verbose_name='Номер теста')
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name='tests', verbose_name='Тема')
    text = models.TextField(verbose_name='Текст теста')
    
    class Meta:
        db_table = 'test'
        verbose_name = 'Тест'
        verbose_name_plural = 'Тесты'
    
    def __str__(self):
        return f"Тест {self.number} - {self.theme.name}"