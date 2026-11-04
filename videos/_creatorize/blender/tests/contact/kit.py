# The contact gate's calibration scene (engine/contact.py). make(clean=False) builds every kind of overlap once, next
# to controls that must stay clean; make(clean=True) builds the same scene with each defect fixed the way contact.md
# says. t01.py (MUST FAIL) and t02.py (MUST PASS) are the two shots; tools/signoff.py runs them.
# Expected from t01 (and nothing else):
#   through  boxB x boxA        a box 0.3 m into a box's front face (in view)
#   floating rock x block       a rock 0.8 m above the ground
#   coplanar decal x plinth     a plane lying exactly on a box top (z-fight)
#   cutaway  pipe x section     a pipe poking 0.6 m out of the cut face
#   camclip  blocker x camera   the camera flies through a box
#   sweep    bullet x pillar    a fast box passes through a pillar between two sampled frames
#   through  pole x crate       a thin pole through a flat crate (13 % of it inside: thin things count at any share)
#   through  boxF x boxE        behind a wall that is hide_render (not in the film: the clip IS visible) (fix round B3)
#   through  boxH x boxG        behind a wall hidden by a hide_render KEY (M.visible / a show-later prop) (fix round B3)
# Info only (both shots, never a finding): hidA x hidB, a box through a box hidden behind the wall (CZ CONTACTINFO).
# Clean controls (both shots): a box on the ground, two boxes side by side, a box stacked on a box, a thin pipe through a
# wall declared intended (contact.allow), an airborne ball, a root in a mound (cz_group).
import bpy
import cz, mega as M, contact as K


def make(F0, F1, clean=False):
    M.setup(F1 + 2, sun_elev=30, sun_rot=210, samples=4, mb=0)
    g = M.pbr('t_ground', '#5b4b3a', rough=0.9); r = M.pbr('t_red', '#b8322a', rough=0.5); b = M.pbr('t_blue', '#3a5ab8', rough=0.5)
    y = M.pbr('t_yel', '#e7b53a', rough=0.5); w = M.pbr('t_white', '#e8e8e8', rough=0.6); d = M.pbr('t_dark', '#303033', rough=0.7)
    # the ground is a cut block: its face at y = -2 is the section, the camera looks at it from -y
    cz.box('block', (40, 30, 3), (0, 13, -1.5), g, bevel=0, ol=0)
    K.section((0, -2, 0), (0, -1, 0), name='section', box=(-20, 20, -10, 28, -3, 0.0))
    # --- the defects (fixed when clean)
    cz.box('boxA', (2, 2, 2), (0, 0, 1), r, bevel=0.02, ol=0)
    cz.box('boxB', (1, 1, 1), (0.5, -1.5 if clean else -1.2, 0.5), b, bevel=0.02, ol=0)   # 0.3 m into boxA's front face
    cz.sphere('rock', 0.4, (-4, 0, 0.4 if clean else 1.2), y, ol=0, segs=24, rings=12)
    cz.box('plinth', (2, 2, 1), (3.5, -0.5, 0.5), w, bevel=0, ol=0)
    cz.plane('decal', 1.2, 1.2, (3.5, -0.5, 1.01 if clean else 1.0), r, rot=(0, 0, 0))
    # (clean: its end 1 cm behind the cut face. Ending exactly IN the face would z-fight with it: coplanar)
    cz.cyl('pipe', 0.15, 1.99 if clean else 2.6, (-2, -1.99 if clean else -2.6, -0.8), w, rot=(-90, 0, 0), verts=24, ol=0)
    cz.box('pillar', (0.6, 0.6, 4), (5.0, 4, 2), w, bevel=0, ol=0)
    bullet = cz.box('bullet', (0.3, 0.3, 0.3), (0, 0, 0), y, bevel=0, ol=0)
    K.airborne(bullet)
    zb = 4.6 if clean else 3.0
    T0 = (F0 - 1) / 30.0                                                         # (t02 runs the same moves later in the film)
    M.bake_path(bullet, F0, F1, pos=lambda t: (-9.9 + 12 * (t - T0), 3.7, zb))    # 0.4 m a frame: in the pillar f38-39 (not while the camera is in the blocker)
    if not clean:
        cz.box('blocker', (0.4, 0.4, 0.4), (0, -20.0, 5.7), d, bevel=0, ol=0)
    # B3: walls the camera's rays meet but the render does not draw (clean: the boxes touch, the walls stay)
    cz.box('boxE', (2, 2, 2), (-5.5, 14, 1), r, bevel=0.02, ol=0)
    cz.box('boxF', (1, 1, 1), (-5.3, 12.5 if clean else 12.8, 0.5), b, bevel=0.02, ol=0)
    hw = cz.box('hidwall', (5, 0.2, 3), (-5.5, 11.5, 1.5), w, bevel=0, ol=0); hw.hide_render = True
    cz.box('boxG', (2, 2, 2), (5.5, 14, 1), r, bevel=0.02, ol=0)
    cz.box('boxH', (1, 1, 1), (5.3, 12.5 if clean else 12.8, 0.5), b, bevel=0.02, ol=0)
    kw = cz.box('keywall', (5, 0.2, 3), (5.5, 11.5, 1.5), w, bevel=0, ol=0)
    kw.hide_render = False; kw.keyframe_insert('hide_render', frame=max(0, F0 - 5))
    kw.hide_render = True; kw.keyframe_insert('hide_render', frame=F0)
    # --- clean controls
    cz.box('rest', (1, 1, 1), (-4.5, 3, 0.5), b, bevel=0.02, ol=0)
    cz.box('sideA', (1, 1, 1), (-2.5, 6, 0.5), r, bevel=0.0, ol=0)
    cz.box('sideB', (1, 1, 1), (-1.5, 6, 0.5), y, bevel=0.0, ol=0)               # touching sideA face to face
    cz.box('stack', (0.8, 0.8, 0.8), (-2.5, 6, 1.4), w, bevel=0.0, ol=0)         # on sideA
    cz.box('wall', (4, 0.25, 2.5), (0, 9, 1.25), w, bevel=0, ol=0)
    tp = cz.cyl('thinpipe', 0.05, 3.0, (0, 7.5, 1.5), d, rot=(-90, 0, 0), verts=16, ol=0)
    K.allow(tp, bpy.data.objects['wall'], group='wallpass')                   # a real pipe through its wall
    cz.box('crate', (1, 1, 0.4), (-4.5, 6, 0.2), b, bevel=0.01, ol=0)
    cz.cyl('pole', 0.06, 3.0, (-3.7 if clean else -4.5, 6, 0), w, verts=16, ol=0)   # (clean: beside the crate)
    cz.box('hidA', (1, 1, 1), (0.3, 10.6, 0.5), r, bevel=0, ol=0)               # behind the wall: unseen
    cz.box('hidB', (1, 1, 1), (0.9, 10.6, 0.5), b, bevel=0, ol=0)
    ball = cz.sphere('ball', 0.3, (-2, 1.5, 4.5), b, ol=0, segs=16, rings=8); K.airborne(ball)
    mound = cz.box('mound', (3, 3, 1), (3.5, 6, 0.5), g, bevel=0.05, ol=0)
    root = cz.cyl('root', 0.12, 1.6, (3.5, 6, 0.3), y, verts=16, ol=0)            # 0.7 m inside the mound
    K.allow(root, mound, group='roots')
    M.Flight([(T0, (0, -22, 6.0), (0, 2, 1), 24), (T0 + 2.0, (0, -18, 5.4), (0, 2, 1), 24)], smooth=0.6).bake(F0, F1)
    return F0, F1
