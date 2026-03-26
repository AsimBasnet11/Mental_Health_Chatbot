# Dummy input_gate.py for pipeline compatibility

def check_input(user_message, has_history=False):
    # Always allow, no gating
    return {"status": "proceed", "response": ""}
