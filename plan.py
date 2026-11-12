"""Nest Golu Padi pieces on 96x48 in plywood sheets (guillotine cuts, 1/8 in kerf)."""
import json, os, random, math, itertools

K = 0.125
SW, SH = 96.0, 48.0
WL = 35.53
T = 0.75
FT = 0.75
TREAD_W, TREAD_L = 11.85, 72.0
PANEL_LEN = 66.47
LINK_LEN, LINK_H = 26.33, 1.75
FOOT = (18.0, 7.0)
RIB_L = 10.6
GAP = {0: 2.97, 1: 3.53, 2: 3.53}      # gap between the two plates of a wall
PT = {0: 0.75, 1: 0.47, 2: 0.47}       # plate thickness by block (A is 19 mm, B and C are 12 mm)
LET = 'ABC'


def r3(v):
    return round(v + 1e-9, 3)


def rect_dist(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return math.hypot(dx, dy)


class Item:
    def __init__(self, ident, kind, w, h, rot_ok, thk, shapes=None, label=''):
        self.id, self.kind, self.w, self.h, self.rot_ok, self.thk = ident, kind, w, h, rot_ok, thk
        # shapes: list of dicts {id, pts(local polygon), rects(local rects x0,y0,x1,y1)}
        self.shapes = shapes
        self.label = label
        self.area = w * h

    def solid(self):
        return self.shapes is not None


def plate_shape(ident, hs, flip):
    pts = [(0, 0), (WL, 0), (WL, hs[2]), (24, hs[2]), (24, hs[1]), (12, hs[1]), (12, hs[0]), (0, hs[0])]
    rects = [(0, 0, 12, hs[0]), (12, 0, 24, hs[1]), (24, 0, WL, hs[2])]
    return {'id': ident, 'pts': pts, 'rects': rects}


def flip_shape(s, Hp):
    pts = [(WL - x, Hp - y) for x, y in s['pts']]
    rects = [(WL - r[2], Hp - r[3], WL - r[0], Hp - r[1]) for r in s['rects']]
    return {'id': s['id'], 'pts': pts, 'rects': rects}


def plates_items(k, R, ids, npairs):
    hs = [(3 * k + j) * R - T - FT for j in (1, 2, 3)]
    thk = PT[k]
    items = []
    ids = list(ids)
    Hp = hs[0] + hs[2] + K
    for _ in range(npairs):
        a, b = ids.pop(0), ids.pop(0)
        s1 = plate_shape(a, hs, False)
        s2 = flip_shape(plate_shape(b, hs, False), Hp)
        items.append(Item(a + '+' + b, 'pair', WL, Hp, True, thk, [s1, s2], 'Wall plates ' + a + ' + ' + b))
    for i in ids:
        items.append(Item(i, 'plate', WL, hs[2], True, thk, [plate_shape(i, hs, False)], 'Wall plate ' + i))
    return items


def build_items(R, pairs):
    """pairs: dict block-> npairs. returns (items19, items12)."""
    i19, i12 = [], []
    for i in range(1, 10):
        i19.append(Item('T%d' % i, 'tread', TREAD_L, TREAD_W, False, 0.75, None, 'Tread %d' % i))
    for k in range(3):
        L = LET[k]
        ids = ['%s%d%s' % (L, w, s) for w in (1, 2, 3) for s in 'ab']
        its = plates_items(k, R, ids, pairs[k])
        (i19 if k == 0 else i12).extend(its)
        hs3 = (3 * k + 3) * R - T - FT
        ph = min(hs3 - 3.0, 47.5)
        i12.append(Item('BP-' + L, 'panel', PANEL_LEN, ph, False, 0.47, None, 'Back panel ' + L))
        gap = GAP[k]
        for w in (1, 2, 3):
            i19.append(Item('F-%s%d' % (L, w), 'foot', FOOT[0], FOOT[1], True, 0.75, None, 'Foot %s%d' % (L, w)))
            for c in (2, 3):
                i19.append(Item('R-%s%d%d' % (L, w, c), 'rib', RIB_L, gap - 0.03, True, 0.75, None, 'Spacer %s%d-%d' % (L, w, c)))
        for n in range(1, 5):
            i19.append(Item('L-%s%d' % (L, n), 'link', LINK_LEN, LINK_H, False, 0.75, None, 'Hinged link %s%d' % (L, n)))
    return i19, i12


class Sheet:
    def __init__(self, thk):
        self.thk = thk
        self.free = [[0.0, 0.0, SW, SH]]
        self.placed = []
        self.cuts = []


def try_fit(sheet, it):
    best = None
    opts = [(it.w, it.h, False)]
    if it.rot_ok and abs(it.w - it.h) > 1e-6:
        opts.append((it.h, it.w, True))
    for fi, f in enumerate(sheet.free):
        for (w, h, rot) in opts:
            if w <= f[2] + 1e-6 and h <= f[3] + 1e-6:
                score = (min(f[2] - w, f[3] - h), max(f[2] - w, f[3] - h))
                if best is None or score < best[0]:
                    best = (score, fi, w, h, rot)
    return best


def do_place(sheet, it, fi, w, h, rot):
    f = sheet.free.pop(fi)
    fx, fy, fw, fh = f
    rw, th = fw - w, fh - h
    # option V: vertical cut first
    def opt_v():
        rects, cuts = [], []
        if rw > 1e-6:
            cuts.append(('V', fx + w + K / 2, fy, fy + fh))
            if rw - K >= 0.5:
                rects.append([fx + w + K, fy, rw - K, fh])
        if th > 1e-6:
            cuts.append(('H', fy + h + K / 2, fx, fx + w))
            if th - K >= 0.5:
                rects.append([fx, fy + h + K, w, th - K])
        return rects, cuts

    def opt_h():
        rects, cuts = [], []
        if th > 1e-6:
            cuts.append(('H', fy + h + K / 2, fx, fx + fw))
            if th - K >= 0.5:
                rects.append([fx, fy + h + K, fw, th - K])
        if rw > 1e-6:
            cuts.append(('V', fx + w + K / 2, fy, fy + h))
            if rw - K >= 0.5:
                rects.append([fx + w + K, fy, rw - K, h])
        return rects, cuts
    rv, cv = opt_v()
    rh, ch = opt_h()
    mv = max([r[2] * r[3] for r in rv] or [0])
    mh = max([r[2] * r[3] for r in rh] or [0])
    rects, cuts = (rv, cv) if mv >= mh else (rh, ch)
    sheet.free.extend(rects)
    sheet.cuts.extend(cuts)
    sheet.placed.append((it, fx, fy, w, h, rot))


def pack(items, thk, order_noise):
    its = sorted(items, key=lambda i: -i.area * (1 + random.uniform(-order_noise, order_noise)))
    sheets = []
    for it in its:
        best = None
        for si, s in enumerate(sheets):
            r = try_fit(s, it)
            if r and (best is None or r[0] < best[0][0]):
                best = (r, si)
        if best is None:
            s = Sheet(thk)
            sheets.append(s)
            r = try_fit(s, it)
            if not r:
                return None
            best = (r, len(sheets) - 1)
        (score, fi, w, h, rot), si = best
        do_place(sheets[si], it, fi, w, h, rot)
    return sheets


def quality(sheets):
    big = max((f[2] * f[3] for s in sheets for f in s.free), default=0)
    return (len(sheets), -big)


def transform_item(it, x, y, w, h, rot):
    """Return list of shapes with absolute sheet coordinates."""
    out = []
    if it.shapes is None:
        out.append({'id': it.id, 'pts': [(x, y), (x + w, y), (x + w, y + h), (x, y + h)], 'rects': [(x, y, x + w, y + h)]})
        return out
    H = it.h
    for s in it.shapes:
        if rot:
            pts = [(x + H - py, y + px) for px, py in s['pts']]
            rects = [(x + H - r[3], y + r[0], x + H - r[1], y + r[2]) for r in s['rects']]
        else:
            pts = [(x + px, y + py) for px, py in s['pts']]
            rects = [(x + r[0], y + r[1], x + r[2], y + r[3]) for r in s['rects']]
        out.append({'id': s['id'], 'pts': pts, 'rects': rects})
    return out


def validate(sheets):
    for si, s in enumerate(sheets):
        allshapes = []
        for (it, x, y, w, h, rot) in s.placed:
            for sh in transform_item(it, x, y, w, h, rot):
                for r in sh['rects']:
                    assert r[0] >= -1e-6 and r[1] >= -1e-6 and r[2] <= SW + 1e-6 and r[3] <= SH + 1e-6, ('bounds', sh['id'])
                allshapes.append(sh)
        for a, b in itertools.combinations(allshapes, 2):
            for ra in a['rects']:
                for rb in b['rects']:
                    d = rect_dist(ra, rb)
                    assert d >= K - 1e-6, ('kerf', a['id'], b['id'], d)


def solve(items, thk, tries, configs):
    best = None
    for cfg_items in configs:
        for t in range(tries):
            sh = pack(cfg_items, thk, 0 if t == 0 else 0.35)
            if sh is None:
                continue
            q = quality(sh)
            if best is None or q < best[0]:
                best = (q, sh)
    return best[1]


def plan_for(R):
    random.seed(7 + R)
    best19 = best12 = None
    # 19 mm class: A plates may be paired 0..3 pairs
    configs19 = [build_items(R, {0: p, 1: 3, 2: 3})[0] for p in range(4)]
    s19 = solve(None, 19, 1500, configs19)
    configs12 = [build_items(R, {0: 3, 1: pb, 2: pc})[1] for pb in range(4) for pc in range(4)]
    s12 = solve(None, 12, 700, configs12)
    return s19, s12


def export(sheets19, sheets12, R):
    sheets = []
    pieces = []
    n = 0
    for grp, thkmm in ((sheets19, 19), (sheets12, 12)):
        for s in grp:
            n += 1
            used = 0
            items = []
            for (it, x, y, w, h, rot) in s.placed:
                shs = transform_item(it, x, y, w, h, rot)
                used += sum((r[2] - r[0]) * (r[3] - r[1]) for sh in shs for r in sh['rects'])
                items.append({'id': it.id, 'kind': it.kind, 'label': it.label,
                              'x': r3(x), 'y': r3(y), 'w': r3(w), 'h': r3(h), 'rot': rot,
                              'shapes': [{'id': sh['id'], 'pts': [[r3(a), r3(b)] for a, b in sh['pts']]} for sh in shs]})
                for sh in shs:
                    ident = sh['id']
                    xs = [p[0] for p in sh['pts']]
                    ys = [p[1] for p in sh['pts']]
                    pc = {'id': ident, 'sheet': n, 'thk': thkmm, 'x': r3(min(xs)), 'y': r3(min(ys)),
                          'bw': r3(max(xs) - min(xs)), 'bh': r3(max(ys) - min(ys))}
                    if it.kind in ('pair', 'plate'):
                        k = LET.index(ident[0])
                        hs = [(3 * k + j) * R - T - FT for j in (1, 2, 3)]
                        pc.update({'kind': 'plate', 'w': WL, 'h': r3(hs[2]), 'cols': [r3(v) for v in hs]})
                    else:
                        pc.update({'kind': it.kind, 'w': r3(it.w), 'h': r3(it.h)})
                    pieces.append(pc)
            cuts = []
            for i, c in enumerate(s.cuts):
                if c[0] == 'V':
                    cuts.append({'n': i + 1, 'o': 'V', 'pos': r3(c[1]), 'a': r3(c[2]), 'b': r3(c[3])})
                else:
                    cuts.append({'n': i + 1, 'o': 'H', 'pos': r3(c[1]), 'a': r3(c[2]), 'b': r3(c[3])})
            sheets.append({'n': n, 'thk': thkmm, 'items': items, 'cuts': cuts,
                           'free': [[r3(v) for v in f] for f in s.free],
                           'util': r3(used / (SW * SH) * 100)})
    return {'R': R, 'sheets': sheets, 'pieces': pieces,
            'summary': {'s19': len(sheets19), 's12': len(sheets12), 'total': len(sheets19) + len(sheets12)}}


if __name__ == '__main__':
    out = {}
    for R in (5, 6):
        s19, s12 = plan_for(R)
        validate(s19)
        validate(s12)
        out[str(R)] = export(s19, s12, R)
        print('R=%d  19mm sheets=%d  12mm sheets=%d  total=%d' % (R, len(s19), len(s12), len(s19) + len(s12)))
        for sh in out[str(R)]['sheets']:
            print('  sheet %2d  %2dmm  util %5.1f%%  items=%s' % (sh['n'], sh['thk'], sh['util'], ','.join(i['id'] for i in sh['items'])))
        cnt = {}
        for p in out[str(R)]['pieces']:
            cnt[p['kind']] = cnt.get(p['kind'], 0) + 1
        print('  pieces', cnt, 'total', sum(cnt.values()))
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'golu-cuts.js'), 'w') as f:
        f.write('window.GP_CUTS=' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('written')
