import json
import urllib.request

QS = [
    "Should a city allow horse-drawn carriage tours downtown? Discuss.",
    "A farmer asks how to increase egg production. What should they consider?",
    "Is it ethical to use monkeys in medical research? Give a reasoned view.",
    "Plan a weekend food tour of Lisbon for two.",
    "What are the main considerations when designing a public aquarium?",
]


def rep_ratio(text):
    w = text.split()
    if len(w) < 60:
        return 1.0
    tail = w[-150:]
    grams = [" ".join(tail[i:i + 4]) for i in range(len(tail) - 3)]
    return len(set(grams)) / max(1, len(grams))


for t in (0.0, 0.7, 1.0):
    for qi, q in enumerate(QS):
        body = json.dumps({
            "model": "distilled-llama31-8b",
            "messages": [{"role": "user", "content": q}],
            "max_tokens": 700, "temperature": t,
        }).encode()
        req = urllib.request.Request(
            "http://localhost:8000/v1/chat/completions", body,
            {"Content-Type": "application/json"})
        c = json.load(urllib.request.urlopen(req))["choices"][0]
        txt = c["message"]["content"]
        fin = c["finish_reason"]
        tail = txt[-90:].replace("\n", " ")
        print(f"t={t} q{qi} finish={fin} len={len(txt.split())}w "
              f"uniq4gram={rep_ratio(txt):.2f} tail={tail!r}")
