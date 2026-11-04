# cuts test 2: an orbit around the tank (3 keys: a C2 spline through the middle key, no stop there).
F0, F1 = 61, 120


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    import mega as M, set_common as C
    C.build_set(F1 + 2)

    # (fix round 2026-10-30: a 22 deg arc, radius 12 - under the 20 deg/s turn cap in 2 s; the old 36 deg arc hit 30)
    M.Flight([(C.T(F0), (0.5, -5.13, 4.0), (5.0, 6.0, 1.6), 24),
              (C.T(90), (2.71, -5.78, 4.3), (5.0, 6.0, 1.6), 24),
              (C.T(F1), (5.0, -6.0, 4.6), (5.0, 6.0, 1.6), 24)]).bake(F0, F1)
    return F0, F1
