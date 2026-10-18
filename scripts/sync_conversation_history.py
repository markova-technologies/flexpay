"""
Antigravity IDE - Conversation History Permanent Syncer & Recovery Tool
Author: Antigravity Agent
Usage: python scripts/sync_conversation_history.py
"""

import os
import sys
import sqlite3
import base64
import re
import shutil

STATE_DB_PATH = os.path.expandvars(r"%APPDATA%\Antigravity IDE\User\globalStorage\state.vscdb")
CONV_DIR = os.path.expandvars(r"%USERPROFILE%\.gemini\antigravity-ide\conversations")

def encode_varint(val):
    out = bytearray()
    while True:
        b = val & 0x7f
        val >>= 7
        if val:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)

def encode_tag(fnum, wtype):
    return encode_varint((fnum << 3) | wtype)

def encode_length_delimited(fnum, val_bytes):
    return encode_tag(fnum, 2) + encode_varint(len(val_bytes)) + val_bytes

def encode_varint_field(fnum, val):
    return encode_tag(fnum, 0) + encode_varint(val)

def encode_timestamp(fnum, seconds, nanos=0):
    ts_bytes = encode_varint_field(1, seconds) + encode_varint_field(2, nanos)
    return encode_length_delimited(fnum, ts_bytes)

def parse_varint(data, offset):
    res = 0
    shift = 0
    while True:
        b = data[offset]
        offset += 1
        res |= (b & 0x7f) << shift
        if not (b & 0x80):
            break
        shift += 7
    return res, offset

def parse_map(data):
    offset = 0
    entries = {}
    while offset < len(data):
        tag, offset = parse_varint(data, offset)
        fnum = tag >> 3
        wtype = tag & 0x7
        if wtype != 2:
            break
        length, offset = parse_varint(data, offset)
        entry_bytes = data[offset:offset+length]
        offset += length
        
        e_offset = 0
        k = None
        v = None
        while e_offset < len(entry_bytes):
            e_tag, e_offset = parse_varint(entry_bytes, e_offset)
            e_fnum = e_tag >> 3
            e_wtype = e_tag & 0x7
            e_len, e_offset = parse_varint(entry_bytes, e_offset)
            e_val = entry_bytes[e_offset:e_offset+e_len]
            e_offset += e_len
            if e_fnum == 1:
                k = e_val.decode('utf-8', errors='ignore')
            elif e_fnum == 2:
                row_offset = 0
                while row_offset < len(e_val):
                    r_tag, row_offset = parse_varint(e_val, row_offset)
                    r_fnum = r_tag >> 3
                    r_len, row_offset = parse_varint(e_val, row_offset)
                    r_bytes = e_val[row_offset:row_offset+r_len]
                    row_offset += r_len
                    if r_fnum == 1:
                        v = r_bytes.decode('utf-8', errors='ignore')
        if k:
            entries[k] = v
    return entries

def extract_title_and_summary(db_path):
    cid = os.path.basename(db_path)[:-3]
    if cid == 'c9e9b63f-aea4-4f62-a64d-52ed2cb74699':
        return "FlexPay v3: Implementation & Deployment", "FlexPay v3: Implementation, M-PESA & Semifinalist Architecture"
    elif cid == '230ab181-d8db-4a14-aa6a-d9920d4ee373':
        return "FlexPay Architecture & FinTech Engine", "FlexPay: FinTech Architecture, Safaricom M-Pesa & Security"
    elif cid == '276f7555-fd7e-4cbc-ac3e-ce64017acf3a':
        return "FlexPay Vercel & Supabase Setup", "FlexPay: Vercel, Supabase Schema & Production Deployment"
    elif cid == 'f161c209-ff08-4260-ba7e-b709dbb7afde':
        return "FlexPay History Recovery & Analysis", "FlexPay Conversation History Recovery & System Persistence"

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT idx, step_payload FROM steps WHERE step_type = 14 ORDER BY idx ASC")
    rows = cur.fetchall()
    
    first_req = ""
    for idx, payload in rows:
        if payload:
            text_matches = re.findall(rb"[A-Za-z0-9_\-\.\:\/\,\'\?\!\@\#\$\%\^\&\*\(\)\+ \n]{15,}", payload)
            for m in text_matches:
                s = m.decode(errors='ignore').strip()
                lines = [l.strip() for l in s.splitlines() if l.strip() and not l.startswith('<') and not l.startswith('The current') and not l.startswith('Active Document')]
                clean = " ".join(lines)
                if len(clean) > 10:
                    first_req = clean
                    break
        if first_req:
            break
            
    if first_req:
        title = first_req[:60]
        return title, first_req[:120]
    return f"Conversation {cid[:8]}", f"Conversation {cid[:8]}"

def build_summary_proto(db_path):
    cid = os.path.basename(db_path)[:-3]
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("SELECT trajectory_id, cascade_id, trajectory_type, source FROM trajectory_meta")
    tmeta = cur.fetchone()
    traj_id = tmeta[0] if tmeta else cid
    traj_type = tmeta[2] if tmeta else 4
        
    cur.execute("SELECT count(*) FROM steps")
    step_count = cur.fetchone()[0]
    
    cur.execute("SELECT data FROM trajectory_metadata_blob WHERE id = 'main'")
    blob_row = cur.fetchone()
    traj_blob = blob_row[0] if blob_row else b""
    
    workspace_uri = "file:///d:/Projects/Markova%20Projects/Flex%20Pay"
    if traj_blob:
        uris = re.findall(rb"file:///[^\x00-\x1f\"'\\]+", traj_blob)
        if uris:
            workspace_uri = uris[0].decode('utf-8', errors='ignore')
            
    mtime = int(os.path.getmtime(db_path))
    ctime = int(os.path.getctime(db_path))
    title, summary = extract_title_and_summary(db_path)
    
    p = encode_length_delimited(1, summary.encode('utf-8'))
    p += encode_varint_field(2, step_count)
    p += encode_timestamp(3, mtime)
    p += encode_length_delimited(4, traj_id.encode('utf-8'))
    p += encode_varint_field(5, 1) # SUCCESS
    p += encode_timestamp(7, ctime)
    
    ws_meta = encode_length_delimited(1, workspace_uri.encode('utf-8'))
    p += encode_length_delimited(9, ws_meta)
    p += encode_timestamp(10, mtime)
    
    annot = encode_length_delimited(1, title.encode('utf-8'))
    p += encode_length_delimited(15, annot)
    
    if traj_blob:
        p += encode_length_delimited(17, traj_blob)
        
    p += encode_varint_field(22, traj_type)
    return cid, p

def encode_row(b64_str):
    return encode_length_delimited(1, b64_str.encode('utf-8'))

def encode_map_entry(key_str, b64_str):
    entry_data = encode_length_delimited(1, key_str.encode('utf-8')) + encode_length_delimited(2, encode_row(b64_str))
    return encode_length_delimited(1, entry_data)

def sync_conversations():
    if not os.path.exists(STATE_DB_PATH):
        print(f"Error: {STATE_DB_PATH} not found.")
        return False
        
    conn = sqlite3.connect(STATE_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries'")
    row = cur.fetchone()
    if not row:
        print("trajectorySummaries key not found in state.vscdb.")
        conn.close()
        return False
        
    raw = base64.b64decode(row[0])
    entries = parse_map(raw)
    print(f"Found {len(entries)} existing conversation entries in state.vscdb.")
    
    if not os.path.exists(CONV_DIR):
        print(f"Conversations dir {CONV_DIR} not found.")
        conn.close()
        return False
        
    all_dbs = [f for f in os.listdir(CONV_DIR) if f.endswith('.db')]
    added = 0
    for f in all_dbs:
        cid = f[:-3]
        if cid not in entries:
            try:
                db_path = os.path.join(CONV_DIR, f)
                cid_out, proto = build_summary_proto(db_path)
                entries[cid_out] = base64.b64encode(proto).decode('utf-8')
                added += 1
                print(f"  + Recovered missing conversation: {cid_out}")
            except Exception as e:
                print(f"  ! Error processing {f}: {e}")
                
    if added > 0:
        new_raw = b""
        for k, v in entries.items():
            new_raw += encode_map_entry(k, v)
        new_b64 = base64.b64encode(new_raw).decode('utf-8')
        cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries'", (new_b64,))
        conn.commit()
        print(f"Successfully synced {added} new conversations to state.vscdb! Total entries: {len(entries)}")
    else:
        print("All disk conversations are already present in state.vscdb! Everything is up to date.")
        
    conn.close()
    return True

if __name__ == "__main__":
    sync_conversations()
