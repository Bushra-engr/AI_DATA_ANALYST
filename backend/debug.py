# backend/debug.py
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.models.connection import SessionLocal
from app.models.tables import Analysis
from app.services.narrator_service import generate_summary

with SessionLocal() as session:
    # Check insights first
    a = session.query(Analysis).filter_by(dataset_id=1).first()
    print("Insights count:", len(a.insights) if a.insights else 0)
    print("Summary before:", a.summary)
    
    # Generate summary
    generate_summary(dataset_id=1, session=session)
    
    # Verify
    session.expire(a)
    a = session.query(Analysis).filter_by(dataset_id=1).first()
    print("Summary after:", a.summary[:200] if a.summary else "STILL NONE")