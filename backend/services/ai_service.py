from ai.agent import (
    generate_question_response,
    generate_final_assessment_response,
)


def generate_questions(context: str):
    return generate_question_response(context)


def generate_final_assessment(context: str):
    return generate_final_assessment_response(context)
