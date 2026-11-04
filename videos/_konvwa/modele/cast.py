# La distribution du film : une fonction par personnage (char.Char), dessins originaux (jamais ceux d'une référence).
# Têtes blanches, torse coloré, une couleur forte par personnage, un détail de costume lisible sur un téléphone.
import char as ch


def heros(name='heros'):
    return ch.Char(name, shirt='#3d6fb6', hair=ch.hair_cap('#2e180b', front=0.62, sides=-0.02, back=-0.85),
                   face_style={'brow_w': 1.0})
