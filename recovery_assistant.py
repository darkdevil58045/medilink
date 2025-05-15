"""
AI-driven Post-Surgery Recovery Assistant Module

This script will track patient recovery metrics, provide reminders, and prioritize reported symptoms.
"""

class RecoveryAssistant:
    def __init__(self):
        self.reminders = []

    def add_reminder(self, reminder):
        self.reminders.append(reminder)

    def get_reminders(self):
        return self.reminders

    def prioritize_symptoms(self, symptoms):
        """
        Prioritize symptoms based on severity using simple rules or AI models.

        Args:
            symptoms (list of dict): Each dict contains 'symptom' and 'severity' keys.

        Returns:
            list: Symptoms sorted by priority (highest severity first)
        """
        return sorted(symptoms, key=lambda x: x.get('severity', 0), reverse=True)

if __name__ == "__main__":
    assistant = RecoveryAssistant()
    assistant.add_reminder("Take medication at 8 AM")
    assistant.add_reminder("Do physiotherapy exercises at 5 PM")
    symptoms = [
        {'symptom': 'Pain', 'severity': 7},
        {'symptom': 'Swelling', 'severity': 5},
        {'symptom': 'Fatigue', 'severity': 3}
    ]
    prioritized = assistant.prioritize_symptoms(symptoms)
    print("Reminders:", assistant.get_reminders())
    print("Prioritized symptoms:", prioritized)
