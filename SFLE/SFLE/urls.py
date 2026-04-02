"""
URL configuration for SFLE project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include


def root(_request):
    """Корень сайта: явный нормальный HTTP-ответ (на / раньше не было маршрута)."""
    body = (
        '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
        '<title>SFLE</title></head><body>'
        '<p>Сервер SFLE отвечает.</p><ul>'
        '<li><a href="/admin/">Админка</a></li>'
        '<li><a href="/api/student/themes/">API: темы студента</a></li>'
        '</ul></body></html>'
    )
    return HttpResponse(body, content_type='text/html; charset=utf-8')


urlpatterns = [
    path('', root),
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/student/', include('student.urls')),
    path('api/admin/', include('admin.urls')),
]
