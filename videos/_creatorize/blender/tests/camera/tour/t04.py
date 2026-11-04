# cutless test, part 4 of 4: ONE camera (set_common.TOUR) over four focal points; every part bakes the same Tour.
F0, F1 = 181, 240


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    import mega as M, set_common as C
    C.build_set(240)
    M.Tour(C.TOUR).bake(F0, F1)
    return F0, F1
