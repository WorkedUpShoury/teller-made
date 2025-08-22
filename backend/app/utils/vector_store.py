import os
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# Initialize ChromaDB
client = chromadb.PersistentClient(path="./chromadb_store")
# Use local model for embeddings
embedding_function = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

# Create or get the collection
collection = client.get_or_create_collection(
    name="resumes",
    embedding_function=embedding_function
)

def add_document(document_text: str, metadata: dict):
    doc_id = metadata.get("source", os.urandom(8).hex())

    collection.add(
        documents=[document_text],
        metadatas=[metadata],
        ids=[doc_id]
    )

def search_documents(query: str, top_k: int = 5):
    results = collection.query(query_texts=[query], n_results=top_k)

    class Doc:
        def __init__(self, content, metadata):
            self.page_content = content
            self.metadata = metadata

    docs = [Doc(doc, meta) for doc, meta in zip(results["documents"][0], results["metadatas"][0])]
    return docs
