from dotenv import load_dotenv

load_dotenv()

from services.ai_service import generate_questions


context = """
ML analysis:

Class: bcc
Disease label: Basal cell carcinoma
Confidence: 50.3%

The user has not provided any additional information yet.

Generate the most relevant follow-up questions for this screening assessment.
"""


result = generate_questions(context)

print("\nAI RESULT:\n")
print(result)

print("\nQUESTIONS:\n")

for question in result.questions:
    print(f"{question.question_id}: {question.question}")
    print(f"Reason: {question.reason}")
    print()