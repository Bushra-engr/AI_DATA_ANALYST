<h1>🤖 AI Data Analyst</h1>

<p>
An AI-powered data analytics platform that allows users to upload datasets, perform automated analysis, generate visualizations, query data using natural language, and receive AI-generated insights.
</p>

<h2>🚀 Live Demo</h2>

<a href="https://ai-data-analyst-yj3p.onrender.com/">View Live Project</a>

<h2>✨ Features</h2>

<ul>
  <li>Upload and analyze CSV/XLSX datasets</li>
  <li>Automated data profiling and quality checks</li>
  <li>Exploratory Data Analysis (EDA)</li>
  <li>Missing value and outlier detection</li>
  <li>Correlation and statistical analysis</li>
  <li>Interactive data visualizations</li>
  <li>Natural language data querying</li>
  <li>AI-powered insights and recommendations</li>
  <li>Natural Language to SQL using DuckDB</li>
  <li>Multi-agent AI workflow for intelligent query routing</li>
  <li>Authentication and analysis history</li>
</ul>

<h2>🛠️ Tech Stack</h2>

<p>
<strong>Backend:</strong> Python, FastAPI, Uvicorn<br>
<strong>AI/LLM:</strong> Groq, LangChain, LangGraph<br>
<strong>Data:</strong> Pandas, NumPy, DuckDB<br>
<strong>ML:</strong> Scikit-learn<br>
<strong>Frontend:</strong> HTML, CSS, JavaScript<br>
<strong>Authentication:</strong> JWT, Passlib
</p>

<h2>⚙️ Run Locally</h2>

<h3>Clone the repository</h3>

```bash
git clone https://github.com/Bushra-engr/AI_DATA_ANALYST.git
cd AI_DATA_ANALYST
```

<h3>Install dependencies</h3>

```bash
pip install -r requirements.txt
```

<h3>Create a <code>.env</code> file</h3>

```env
GROQ_API_KEY=your_groq_api_key
```

<h3>Run the backend</h3>

```bash
uvicorn backend.app.main:app --reload --port 8001
```

<h2>🔐 Environment Variables</h2>

<table>
  <tr>
    <th>Variable</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>GROQ_API_KEY</td>
    <td>Groq API key used for LLM-powered analysis</td>
  </tr>
</table>

<blockquote>
Never commit your <code>.env</code> file or API keys to GitHub.
</blockquote>

<h2>👩‍💻 Author</h2>

<p>
<strong>Bushra</strong><br>
GitHub: <a href="https://github.com/Bushra-engr">Bushra-engr</a>
</p>
