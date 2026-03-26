"""
Followup Questions Bank
Emotion-based followup questions for the mental health counseling chatbot.
Used by LLMResponder to append a relevant 4th sentence to responses.

Emotions: 15 total
  High priority (6 questions): sadness, anger, fear, grief, nervousness, disappointment, embarrassment
  Medium priority (4 questions): confusion, annoyance, disapproval, desire, realization
  Positive (3 questions):       joy, gratitude, relief, love
"""

FOLLOWUP_QUESTIONS = {

    # ── HIGH PRIORITY ──────────────────────────────────────────────────────────

    "sadness": [
        "What do you think has been weighing on you the most lately?",
        "Is there a particular moment that made you feel this way?",
        "How long have you been carrying these feelings?",
        "Is there something specific that happened that brought this on?",
        "Have you been able to give yourself any space to just feel this?",
        "Is there anyone in your life who knows what you're going through right now?",
    ],

    "anger": [
        "What do you think is really behind this feeling for you?",
        "Has something specific been pushing you to this point?",
        "How do you usually cope when this feeling gets overwhelming?",
        "Is this something that's been building up for a while?",
        "Do you feel like your anger is being heard or understood by anyone?",
        "What would it take for this situation to feel even slightly more fair to you?",
    ],

    "fear": [
        "What feels most uncertain or scary for you right now?",
        "Has this fear been with you for a long time or is it something new?",
        "What would make you feel even a little safer in this situation?",
        "Is there something specific you're afraid might happen?",
        "How much is this fear affecting your day-to-day life?",
        "Have you ever faced something similar before — what helped you then?",
    ],

    "grief": [
        "How long ago did this loss happen?",
        "Do you have people around you who understand what you're going through?",
        "What do you miss most?",
        "Have you given yourself permission to grieve at your own pace?",
        "Is there a memory of them or it that brings you some comfort?",
        "How are you taking care of yourself through this?",
    ],

    "nervousness": [
        "What's the main thing your mind keeps coming back to?",
        "Is this nervousness tied to something coming up or more of a constant feeling?",
        "How does this show up for you physically — do you notice it in your body?",
        "Have you been able to slow down and breathe through it at all?",
        "Is there someone who makes you feel calmer just by being around them?",
        "What's the worst thing you imagine happening, and how likely do you think it really is?",
    ],

    "disappointment": [
        "What were you hoping would happen differently?",
        "Is this disappointment about someone else or about yourself?",
        "How long have you been sitting with this feeling?",
        "Do you feel like you could have done anything differently, or was it out of your hands?",
        "Has this happened before with the same person or situation?",
        "What would help you start to move forward from this?",
    ],

    "embarrassment": [
        "What happened that's making you feel this way?",
        "Do you feel like others are still thinking about it, or is it more in your own head?",
        "Has something like this happened before — how did you get through it?",
        "What would you say to a close friend who went through the same thing?",
        "How much space is this taking up in your mind right now?",
        "Is there someone you trust enough to laugh about this with eventually?",
    ],

    # ── MEDIUM PRIORITY ────────────────────────────────────────────────────────

    "confusion": [
        "What part of the situation feels most unclear to you right now?",
        "Is this confusion about what you're feeling, or about what's happening around you?",
        "Has anything happened recently that might have triggered this feeling?",
        "What would help you feel more grounded or clear right now?",
    ],

    "annoyance": [
        "What's been getting under your skin the most lately?",
        "Is this about one specific thing or has it been building from multiple directions?",
        "Do you feel like you've been able to express this or have you been holding it in?",
        "What would need to change for this to stop bothering you?",
    ],

    "disapproval": [
        "What is it about the situation that feels wrong to you?",
        "Have you been able to express how you feel about this to anyone involved?",
        "Is this something you feel strongly enough to act on?",
        "How is holding onto this affecting you personally?",
    ],

    "desire": [
        "What is it that you feel is missing most right now?",
        "How long have you been feeling this way?",
        "Is this something you feel is within reach or does it feel far away?",
        "What's one small step that might move you closer to what you want?",
    ],

    "realization": [
        "How does it feel to see things this way now?",
        "Is this realization bringing you relief or is it difficult to sit with?",
        "What do you think you'll do differently now that you see this?",
        "Is there someone you'd want to share this with?",
    ],

    # ── POSITIVE ───────────────────────────────────────────────────────────────

    "joy": [
        "What's been bringing this positive energy into your life?",
        "How can you hold on to this feeling or create more of it?",
        "What or who has made the biggest difference for you lately?",
    ],

    "gratitude": [
        "What's made you feel most grateful recently?",
        "Is there someone you haven't yet told how much they mean to you?",
        "How does holding onto this feeling change your outlook on things?",
    ],

    "relief": [
        "What finally made things feel lighter for you?",
        "How long were you carrying that weight before this?",
        "What does this relief make possible for you now?",
    ],

    "love": [
        "What does this connection mean to you?",
        "How has this relationship shaped who you are?",
        "Is there something you've been wanting to express to them?",
    ],

    # ── DEFAULT FALLBACK ───────────────────────────────────────────────────────

    "default": [
        "How long have you been feeling this way?",
        "What do you think triggered these feelings for you?",
        "Is there someone in your life you've been able to talk to about this?",
        "What would feel most helpful for you right now?",
        "What does a good day look like for you compared to days like today?",
    ],
}
