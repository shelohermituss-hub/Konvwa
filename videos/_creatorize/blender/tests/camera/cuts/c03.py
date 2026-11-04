# cuts test 3: a rise over the pipe with a lens change, the target lifting with it.
F0, F1 = 121, 180


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    import mega as M, set_common as C
    C.build_set(F1 + 2)
    # (fix round 2026-10-30: a smaller rise, under the 20 deg/s turn cap in 2 s; the old 8 m rise turned 36 deg/s)
    M.Flight([(C.T(F0), (8.0, -12.0, 1.5), (6.5, -3.0, 0.6), 22),
              (C.T(F1), (9.5, -11.5, 4.5), (6.2, -2.5, 0.4), 30)]).bake(F0, F1)
    return F0, F1
