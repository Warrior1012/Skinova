from ai.rag.retriever import retrieve_medical_context


query = """
The skin lesion has changed in size and color and sometimes bleeds.
The ML model classified the lesion as melanoma with moderate confidence.
What medical information is relevant for this screening assessment?
"""


results = retrieve_medical_context(
    query,
    top_k=3
)


print("\nRAG RESULTS")
print("=" * 60)


for result in results:

    print("\nSOURCE:", result["id"])
    print("SIMILARITY:", round(result["score"], 4))
    print("-" * 60)
    print(result["text"])