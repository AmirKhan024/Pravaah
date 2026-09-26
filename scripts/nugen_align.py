#!/usr/bin/env python3
"""
Nugen Intelligence Model Alignment Script for Pravaah
HackCelestial 3.0 Mandatory Requirement

Workflow:
1. Upload domain documents (docs/nugen_alignment/*)
2. Trigger model alignment on base model (qwen-v2p5-0p5b-instruct)
3. Poll alignment status until ready
4. Update .env.local with NUGEN_MODEL_ID and NUGEN_ALIGNMENT_ID
5. Execute live test inference with confidence score verification
"""

import os
import sys
import time
import json
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests library...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env.local"
API_URL = "https://api.nugen.in/api/v3"

def load_env():
    env = {}
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def update_env(key, val):
    lines = []
    found = False
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{key}="):
            new_lines.append(f"{key}={val}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={val}\n")
    
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

def main():
    print("=" * 60)
    print("  PRAVAAH - NUGEN INTELLIGENCE DOMAIN ALIGNMENT")
    print("  HackCelestial 3.0 Mandatory Technology Workflow")
    print("=" * 60)

    env = load_env()
    api_key = os.getenv("NUGEN_API_KEY") or env.get("NUGEN_API_KEY")

    if not api_key:
        print("\n[!] NUGEN_API_KEY not found in environment or .env.local")
        api_key = input("Enter your Nugen API Key: ").strip()
        if not api_key:
            print("Error: Nugen API Key is required.")
            sys.exit(1)
        update_env("NUGEN_API_KEY", api_key)

    headers = {"Authorization": f"Bearer {api_key}"}

    # Step 1: Upload Domain Documents
    corpus_dir = BASE_DIR / "docs" / "nugen_alignment"
    if not corpus_dir.exists():
        print(f"Error: Corpus directory not found at {corpus_dir}")
        sys.exit(1)

    doc_files = list(corpus_dir.glob("*.md"))
    if not doc_files:
        print("Error: No domain markdown documents found in docs/nugen_alignment/")
        sys.exit(1)

    print(f"\n[1/4] Uploading {len(doc_files)} domain document(s) to Nugen...")
    uploaded_doc_ids = []

    for file_path in doc_files:
        print(f"  -> Uploading: {file_path.name}")
        with open(file_path, "rb") as f:
            r = requests.post(
                f"{API_URL}/documents/upload",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (file_path.name, f, "text/markdown")},
                data={"category": "crowd_dynamics_safety"}
            )
        if r.status_code not in (200, 201):
            print(f"  [X] Upload failed ({r.status_code}): {r.text}")
            continue
        res_data = r.json()
        doc_id = res_data.get("document_id") or (res_data.get("document_ids") or [None])[0]
        if doc_id:
            print(f"  [✓] Document registered: {doc_id}")
            uploaded_doc_ids.append(doc_id)
        else:
            print(f"  [!] Received response without document ID: {res_data}")

    if not uploaded_doc_ids:
        print("\n[!] Could not upload documents. Check API key or network connection.")
        sys.exit(1)

    # Step 2: Create Alignment Project
    print("\n[2/4] Initializing Domain Alignment Project...")
    base_model = "qwen-v2p5-0p5b-instruct"
    align_payload = {
        "alignment_name": "Pravaah-Crowd-Dynamics-Alignment",
        "base_model_id": base_model,
        "document_ids": uploaded_doc_ids,
        "description": "Align base model with Pravaah crowd safety, chokepoint dispatch, and scenario patching SOPs"
    }

    r = requests.post(
        f"{API_URL}/alignment-projects/create",
        headers={**headers, "Content-Type": "application/json"},
        json=align_payload
    )

    if r.status_code not in (200, 201):
        print(f"[X] Alignment project creation failed ({r.status_code}): {r.text}")
        sys.exit(1)

    project_data = r.json()
    alignment_id = project_data.get("alignment_id")
    print(f"[✓] Alignment project created successfully! ID: {alignment_id}")
    update_env("NUGEN_ALIGNMENT_ID", alignment_id)

    # Step 3: Poll Alignment Status
    print("\n[3/4] Training & Aligning model to Pravaah domain...")
    print("Polling Nugen alignment status (this takes a short while)...")

    aligned_model_id = None
    start_time = time.time()

    while True:
        try:
            r = requests.get(f"{API_URL}/alignment-projects/{alignment_id}/status", headers=headers)
            if r.status_code == 200:
                stat = r.json()
                status = stat.get("status", "UNKNOWN").upper()
                elapsed = int(time.time() - start_time)
                print(f"  [{elapsed}s] Status: {status}")

                if status in ("COMPLETED", "READY", "SUCCESS"):
                    aligned_model_id = stat.get("model_id") or stat.get("aligned_model_id")
                    break
                elif status in ("FAILED", "ERROR"):
                    print(f"\n[X] Alignment failed: {stat}")
                    sys.exit(1)
            else:
                print(f"  Warning: status check returned {r.status_code}")
        except Exception as e:
            print(f"  Polling exception: {e}")

        time.sleep(10)

    print(f"\n[✓] DOMAIN ALIGNMENT SUCCESSFUL!")
    print(f"    Aligned Model ID: {aligned_model_id}")
    update_env("NUGEN_MODEL_ID", aligned_model_id)

    # Step 4: Verification Inference
    print("\n[4/4] Testing live domain inference with confidence score...")
    test_payload = {
        "model": aligned_model_id,
        "messages": [
            {
                "role": "system",
                "content": "You convert an event organiser's what-if question into a JSON scenario patch for a crowd simulator."
            },
            {
                "role": "user",
                "content": "What if 20% more people show up and it rains?"
            }
        ],
        "temperature": 0
    }

    try:
        r = requests.post(
            f"{API_URL}/inference/chat/completions",
            headers={**headers, "Content-Type": "application/json"},
            json=test_payload,
            timeout=15
        )
        if r.status_code == 200:
            inf_res = r.json()
            content = inf_res.get("choices", [{}])[0].get("message", {}).get("content")
            conf = inf_res.get("confidence_score")
            print("\n" + "=" * 60)
            print("  LIVE INFERENCE TEST RESULT")
            print("=" * 60)
            print(f"Model ID:         {aligned_model_id}")
            print(f"Confidence Score: {conf}%")
            print(f"Response:\n{content}")
            print("=" * 60)
            print("\nSUCCESS: All setup complete! .env.local has been updated.")
        else:
            print(f"Inference test status {r.status_code}: {r.text}")
    except Exception as e:
        print(f"Inference test error: {e}")

if __name__ == "__main__":
    main()
