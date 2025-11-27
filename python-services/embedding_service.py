"""
Servicio de embeddings local usando sentence-transformers
Este servicio corre un servidor HTTP que genera embeddings de texto
para matching inteligente de auto-respuestas.

Instalación:
pip install sentence-transformers flask flask-cors numpy

Uso:
python embedding_service.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Cargar modelo (usa un modelo multilingüe optimizado para español)
# Opciones:
# - 'paraphrase-multilingual-MiniLM-L12-v2' (más rápido, 118MB)
# - 'paraphrase-multilingual-mpnet-base-v2' (mejor calidad, 278MB)
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
logger.info(f"Cargando modelo {MODEL_NAME}...")
model = SentenceTransformer(MODEL_NAME)
logger.info("Modelo cargado exitosamente")

def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calcula la similitud coseno entre dos vectores"""
    return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "model": MODEL_NAME})

@app.route('/embed', methods=['POST'])
def embed():
    """
    Genera embeddings para uno o más textos

    Request body:
    {
        "texts": ["texto 1", "texto 2", ...]
    }

    Response:
    {
        "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]]
    }
    """
    try:
        data = request.get_json()
        texts = data.get('texts', [])

        if not texts:
            return jsonify({"error": "No texts provided"}), 400

        if isinstance(texts, str):
            texts = [texts]

        # Generar embeddings
        embeddings = model.encode(texts, convert_to_numpy=True)

        # Convertir a lista para JSON
        embeddings_list = embeddings.tolist()

        return jsonify({
            "embeddings": embeddings_list,
            "dimension": len(embeddings_list[0])
        })

    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/similarity', methods=['POST'])
def similarity():
    """
    Calcula similitud entre un texto y una lista de textos de referencia

    Request body:
    {
        "query": "texto a buscar",
        "references": [
            {"id": 1, "text": "texto referencia 1"},
            {"id": 2, "text": "texto referencia 2"}
        ],
        "threshold": 0.7  // opcional, default 0.7
    }

    Response:
    {
        "matches": [
            {"id": 1, "score": 0.85},
            {"id": 2, "score": 0.72}
        ]
    }
    """
    try:
        data = request.get_json()
        query = data.get('query', '')
        references = data.get('references', [])
        threshold = data.get('threshold', 0.7)

        if not query:
            return jsonify({"error": "No query provided"}), 400

        if not references:
            return jsonify({"matches": []})

        # Generar embedding para la consulta
        query_embedding = model.encode([query], convert_to_numpy=True)[0]

        # Generar embeddings para referencias
        reference_texts = [ref['text'] for ref in references]
        reference_embeddings = model.encode(reference_texts, convert_to_numpy=True)

        # Calcular similitudes
        matches = []
        for i, ref in enumerate(references):
            score = cosine_similarity(query_embedding, reference_embeddings[i])
            if score >= threshold:
                matches.append({
                    "id": ref.get('id'),
                    "score": round(score, 4),
                    "text": ref.get('text', '')[:100]  # Primeros 100 chars para debug
                })

        # Ordenar por score descendente
        matches.sort(key=lambda x: x['score'], reverse=True)

        return jsonify({
            "query": query,
            "matches": matches,
            "total_checked": len(references),
            "threshold": threshold
        })

    except Exception as e:
        logger.error(f"Error calculating similarity: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/batch-similarity', methods=['POST'])
def batch_similarity():
    """
    Calcula similitud entre múltiples queries y referencias
    Útil para procesar varios mensajes en paralelo

    Request body:
    {
        "queries": ["query1", "query2"],
        "references": [
            {"id": 1, "text": "ref1"},
            {"id": 2, "text": "ref2"}
        ],
        "threshold": 0.7
    }

    Response:
    {
        "results": [
            {"query": "query1", "matches": [...]},
            {"query": "query2", "matches": [...]}
        ]
    }
    """
    try:
        data = request.get_json()
        queries = data.get('queries', [])
        references = data.get('references', [])
        threshold = data.get('threshold', 0.7)

        if not queries:
            return jsonify({"error": "No queries provided"}), 400

        if not references:
            return jsonify({"results": [{"query": q, "matches": []} for q in queries]})

        # Generar embeddings en batch
        query_embeddings = model.encode(queries, convert_to_numpy=True)
        reference_texts = [ref['text'] for ref in references]
        reference_embeddings = model.encode(reference_texts, convert_to_numpy=True)

        # Procesar cada query
        results = []
        for i, query in enumerate(queries):
            matches = []
            for j, ref in enumerate(references):
                score = cosine_similarity(query_embeddings[i], reference_embeddings[j])
                if score >= threshold:
                    matches.append({
                        "id": ref.get('id'),
                        "score": round(score, 4),
                        "text": ref.get('text', '')[:100]
                    })

            matches.sort(key=lambda x: x['score'], reverse=True)
            results.append({
                "query": query,
                "matches": matches
            })

        return jsonify({"results": results})

    except Exception as e:
        logger.error(f"Error in batch similarity: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Correr en puerto 5001 para no interferir con otros servicios
    app.run(host='0.0.0.0', port=5001, debug=False)
