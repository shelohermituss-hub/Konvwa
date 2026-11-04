# Contact gate calibration, MUST FAIL with exactly the nine findings listed in kit.py (a gate is trusted only once it
# has been seen to fail).
F0, F1 = 1, 60


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import kit
    return kit.make(F0, F1, clean=False)
