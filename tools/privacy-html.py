"""docs/privacy-policy.md -> docs/privacy-policy.html (the page Play links to).

Run after editing the policy:  python3 tools/privacy-html.py
Handles only what the policy uses: headings, paragraphs, bullet lists, one
table, **bold**, _italic_ and [links](url).
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
md = (ROOT / 'docs/privacy-policy.md').read_text()


def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w/])_(.+?)_(?![\w/])', r'<em>\1</em>', t)
    return re.sub(r'\[([^\]]+)\]\(((?:https?|mailto):[^)]+)\)', r'<a href="\2">\1</a>', t)


out, para, lines, i = [], [], md.split('\n'), 0


def flush():
    if para:
        out.append('<p>' + inline(' '.join(para)) + '</p>')
        para.clear()


while i < len(lines):
    line = lines[i]
    if line.startswith('# '):
        flush(); out.append('<h1>' + inline(line[2:]) + '</h1>')
    elif line.startswith('## '):
        flush(); out.append('<h2>' + inline(line[3:]) + '</h2>')
    elif line.startswith('- '):
        flush(); items = []
        while i < len(lines) and (lines[i].startswith('- ') or lines[i].startswith('  ')):
            if lines[i].startswith('- '):
                items.append(lines[i][2:])
            else:
                items[-1] += ' ' + lines[i].strip()
            i += 1
        out.append('<ul>' + ''.join('<li>' + inline(x) + '</li>' for x in items) + '</ul>')
        continue
    elif line.startswith('|'):
        flush(); rows = []
        while i < len(lines) and lines[i].startswith('|'):
            cells = [c.strip() for c in lines[i].strip('|').split('|')]
            if not all(set(c) <= set('-: ') for c in cells):
                rows.append(cells)
            i += 1
        head, body = rows[0], rows[1:]
        out.append('<table><thead><tr>' + ''.join('<th>' + inline(c) + '</th>' for c in head)
                   + '</tr></thead><tbody>'
                   + ''.join('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in r) + '</tr>' for r in body)
                   + '</tbody></table>')
        continue
    elif not line.strip():
        flush()
    else:
        para.append(line.strip())
    i += 1
flush()

page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farmer's Choice — Privacy Policy</title>
<style>
:root{{--ink:#1A1F1B;--muted:#5E6860;--line:#E2E0D6;--green:#1B7A3E;--bg:#FAF8F2}}
@media (prefers-color-scheme: dark){{:root{{--ink:#ECEDE8;--muted:#A9B0AA;--line:#33382F;--green:#6FCB8E;--bg:#141713}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Telugu",sans-serif}}
main{{max-width:760px;margin:0 auto;padding:32px 16px 64px}}
h1{{font-size:28px;line-height:1.2;color:var(--green)}} h2{{font-size:20px;margin-top:32px}}
a{{color:var(--green)}} em{{color:var(--muted)}}
table{{border-collapse:collapse;width:100%;font-size:15px;margin:12px 0}} th,td{{border:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}}
th{{background:rgba(27,122,62,.08)}}
@media (max-width:600px){{table,thead,tbody,tr,th,td{{display:block}} thead{{display:none}} td{{border:0;border-bottom:1px solid var(--line)}} tr{{border:1px solid var(--line);margin-bottom:12px}}}}
</style></head><body><main>
{chr(10).join(out)}
</main></body></html>
'''
(ROOT / 'docs/privacy-policy.html').write_text(page)
print('wrote docs/privacy-policy.html')
