from django.core.management.base import BaseCommand

from portal_api.services import PromotionService


class Command(BaseCommand):
    help = "Promote every active student to their next year/semester (or graduate them). Run at semester end."

    def handle(self, *args, **options):
        results = PromotionService.promote_all_active()
        self.stdout.write(self.style.SUCCESS(f"Processed {len(results)} students."))
