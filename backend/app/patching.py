# app/patching.py
from __future__ import annotations
from typing import Any, Dict, List
from copy import deepcopy

try:
    import jsonpatch
except ImportError:
    jsonpatch = None

def apply_json_patch(doc: Dict[str, Any], ops: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not ops: return doc
    base = deepcopy(doc)
    if jsonpatch:
        ops2 = []
        for op in ops:
            o = dict(op)
            if "from_" in o: o["from"] = o.pop("from_")
            ops2.append(o)
        return jsonpatch.apply_patch(base, ops2, in_place=False)

    # minimal fallback for add/replace/remove
    for op in ops:
        action = op["op"]; path = op["path"]; value = op.get("value")
        if not path.startswith("/"): raise ValueError(f"Bad path: {path}")
        keys = [k for k in path.split("/")[1:] if k]
        parent = base
        for k in keys[:-1]:
            parent = parent[int(k)] if isinstance(parent, list) else parent.setdefault(k, {})
        last = keys[-1] if keys else None
        if action == "replace":
            (parent.__setitem__(int(last), value) if isinstance(parent, list) else parent.__setitem__(last, value))
        elif action == "add":
            if isinstance(parent, list):
                parent.append(value) if last == "-" else parent.insert(int(last), value)
            else:
                parent[last] = value
        elif action == "remove":
            (parent.pop(int(last)) if isinstance(parent, list) else parent.pop(last, None))
        else:
            raise ValueError(f"Unsupported op in fallback: {action}")
    return base
