# Contact gate calibration, MUST PASS: the same scene as t01 with every defect fixed (no false positives).
F0, F1 = 61, 120


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import kit
    return kit.make(F0, F1, clean=True)
