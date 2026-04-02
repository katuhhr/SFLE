from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

from . import views

urlpatterns = [
    path('register/', views.register, name='auth_register'),
    # JWT login
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Current user
    path('me/', views.me, name='auth_me'),
]
