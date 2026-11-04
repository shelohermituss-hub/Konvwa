# cuts test 1: a push toward the tower (2 keys), one eased move, cut on rest.
F0, F1 = 1, 60


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    import mega as M, set_common as C
    C.build_set(F1 + 2)
    M.Flight([(C.T(F0), (-2.0, -14.0, 5.0), (-6.0, 4.0, 3.0), 24),
              (C.T(F1), (-4.0, -6.0, 4.0), (-6.0, 4.0, 3.2), 26)]).bake(F0, F1)
    return F0, F1
