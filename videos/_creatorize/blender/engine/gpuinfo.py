# Which graphics card Blender draws EEVEE on. One line: CZ GPU {"backend", "vendor", "renderer", "version", "type", "devices"}
#   blender -b --factory-startup [--gpu-backend vulkan] -P engine/gpuinfo.py
# Creatorize asks it for Export > Render settings ("Blender renders on ...") and to find laptops whose OpenGL lands on the
# built-in graphics while Vulkan reaches the graphics card; run.py prints the same line after every render, so a shot's
# render log says where its frames were drawn (2026-10-31: a member saw only the processor busy while frames rendered;
# on the RTX 5080 they are drawn on the card, OpenGL 4.6 NVIDIA, the processor moves the scene into place first).
import json
import gpu


def info():
    try: gpu.platform.backend_type_get()
    except Exception:
        try: gpu.init()            # (background Blender starts its GPU only when something draws)
        except Exception as e: return {'error': str(e)}
    d = {}
    for k, f in (('backend', 'backend_type_get'), ('vendor', 'vendor_get'), ('renderer', 'renderer_get'),
                 ('version', 'version_get'), ('type', 'device_type_get')):
        try: d[k] = str(getattr(gpu.platform, f)())
        except Exception: d[k] = ''
    try: d['devices'] = [{'id': str(x.identifier), 'name': str(x.name)} for x in gpu.platform.devices_get()]
    except Exception: d['devices'] = []
    return d


def line():
    return 'CZ GPU ' + json.dumps(info())


if __name__ == '__main__':
    print(line(), flush=True)
