# (hormuz) contact sheet of arbitrary images: python3 tools/contact.py out.jpg cols cellW cellH img...
import subprocess, sys
out, cols, w, h, *imgs = sys.argv[1:]
cols, w, h = int(cols), int(w), int(h)
args, f = [], ''
for i, p in enumerate(imgs):
    args += ['-i', p]
    f += f'[{i}]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[v{i}];'
lay = '|'.join(f'{(i % cols) * w}_{(i // cols) * h}' for i in range(len(imgs)))
f += ''.join(f'[v{i}]' for i in range(len(imgs))) + f'xstack=inputs={len(imgs)}:layout={lay}:fill=black'
sys.exit(subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-filter_complex', f, out]).returncode)
