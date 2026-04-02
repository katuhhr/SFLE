from django.contrib import admin
from .models import (
    User, Group, Course, Major, Schedule, 
    Theory, File, Question, AnswerOption
)

@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'firstname', 'lastname', 'email', 'role', 'group', 'is_staff', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff', 'group')
    search_fields = ('username', 'firstname', 'lastname', 'email')

class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 3

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'text_type')
    list_filter = ('text_type',)
    inlines = [AnswerOptionInline]

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'major', 'teacher')
    list_filter = ('course', 'major')

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_couple_time', 'cabinet')
    filter_horizontal = ('groups',)

@admin.register(Theory)
class TheoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    filter_horizontal = ('files',)

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'storage_url')

admin.site.register(Course)
admin.site.register(Major)
