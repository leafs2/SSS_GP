# Algorithm Service

Python-based algorithm service for surgical scheduling system.

## 📁 Project Structure

```
algorithm/
├── app/
│   ├── api/              # API endpoints
│   ├── algorithms/       # Algorithm implementations
│   │   ├── scheduling/   # Scheduling algorithms
│   │   ├── assignment/   # Assignment algorithms
│   │   └── optimization/ # Optimization algorithms
│   ├── models/           # Pydantic models
│   ├── utils/            # Utility functions
│   ├── core/             # Core configuration
│   └── main.py           # Application entry point
├── tests/                # Test files
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variables template
├── Dockerfile            # Docker configuration
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- pip

### Installation

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Running the Service

#### Development Mode
```bash
uvicorn app.main:app --reload --port 8000
```

#### Production Mode
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Using Docker
```bash
docker build -t algorithm-service .
docker run -p 8000:8000 algorithm-service
```

## 📡 API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🧪 Testing

```bash
pytest tests/
```

## 📦 Adding New Algorithms

1. Create a new directory in `app/algorithms/` for your algorithm category
2. Implement your algorithm as a Python module
3. Create corresponding API endpoint in `app/api/`
4. Add request/response models in `app/models/`
5. Write tests in `tests/`

## 🔧 Configuration

See `.env.example` for all available configuration options.

## 📝 License

[Your License Here]
