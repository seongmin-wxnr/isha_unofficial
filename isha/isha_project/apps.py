import sys
from django.apps import AppConfig
from . import scheduler
import os

class IshaProjectConfig(AppConfig):
    name = 'isha_project'

    def ready(self) -> None:
        if 'runserver' not in sys.argv and 'gunicorn' not in sys.argv[0]:
            return

        if os.environ.get('RUN_MAIN') != 'true' and 'gunicorn' not in sys.argv[0]:
            return
        scheduler.start()