import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Section } from '@/components/Section';
import { BrandHeader } from '@/components/BrandHeader';
import { exportBackup, importBackup } from '@/utils/backup';
import { usePro } from '@/purchases/pro';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

interface Item {
  name: string;
  why: string;
}

const ESSENTIALS: Item[] = [
  {
    name: 'Rod & reel combo — 6\'6"–7\' medium spinning',
    why: 'A pre-matched spinning combo is the easiest first setup and handles most freshwater and light inshore fishing.',
  },
  {
    name: 'Fishing line — 8–12 lb monofilament',
    why: 'Cheap, forgiving, floats, and ties easy knots. Spool it on or ask the shop to. Step up to 15–20 lb for bigger/saltwater fish.',
  },
  {
    name: 'Hooks — assorted #1 to 2/0',
    why: 'A small pack of bait hooks covers panfish to bass. Circle hooks (1/0–3/0) are great for live bait and better for releasing fish.',
  },
  {
    name: 'Sinkers & split shot',
    why: 'A few removable split shot and some 1/8–1/2 oz weights get your bait down and let you cast it.',
  },
  {
    name: 'Bobbers / floats',
    why: 'Suspend bait at a set depth and show you the bite. A couple of clip-on bobbers is plenty to start.',
  },
  {
    name: 'Swivels & a leader spool',
    why: 'Barrel swivels stop line twist; a short heavier leader protects against teeth and abrasion (essential in saltwater).',
  },
  {
    name: 'A few lures',
    why: 'Start simple: soft-plastic worms/grubs with jigheads, a small inline spinner, and one topwater. Match what bayLURE recommends.',
  },
  {
    name: 'Live or prepared bait',
    why: 'Nightcrawlers (fresh) or live/dead shrimp (salt) catch nearly everything and are perfect while you learn.',
  },
  {
    name: 'Needle-nose pliers',
    why: 'Remove hooks safely, crimp split shot, and bend barbs. The one tool you will use every trip.',
  },
  {
    name: 'Line cutters / nail clippers',
    why: 'Trim knots clean. Cheap and indispensable.',
  },
  {
    name: 'A small tackle box',
    why: 'Keeps hooks, weights, and lures organized and dry.',
  },
  {
    name: 'Landing net (optional)',
    why: 'Makes landing and releasing fish easier and safer for the fish.',
  },
  {
    name: 'Cooler or stringer',
    why: 'Only if you plan to keep legal fish — keep them cold and fresh.',
  },
];

const COMFORT: Item[] = [
  { name: 'Fishing license', why: 'Required almost everywhere. Buy online from your state agency before you go — see the Regulations card on the Plan tab.' },
  { name: 'Polarized sunglasses', why: 'Cut glare so you can see into the water and protect your eyes from hooks.' },
  { name: 'Hat, sunscreen, water', why: 'You will be exposed for hours. Hydrate and cover up.' },
  { name: 'Towel / rag & small first-aid kit', why: 'Fish are slimy and hooks are sharp — be ready.' },
  { name: 'Tape measure & a phone', why: 'Measure fish against size limits and log your catch in bayLURE.' },
];

function plural(n: number, word: string, pluralWord?: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${pluralWord ?? `${word}s`}`;
}

function BackupSection() {
  const styles = useStyles();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const msg = await fn();
      if (msg) setStatus(msg);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Backup & Restore">
      <Text style={styles.para}>
        Your saved spots, presets, and catch log live only on this device.
        Export them to a backup file you keep (Files, Drive, email — anywhere),
        and import that file later to restore them or move to a new phone.
        Importing only adds: nothing already saved here is changed or deleted.
        Catch photos taken on this phone stay on this phone.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.linkBtn, pressed && pressedStyle]}
        onPress={() =>
          run(async () => {
            const res = await exportBackup();
            return res
              ? `Exported ${plural(res.spots, 'spot')}, ${plural(res.presets, 'preset')}, and ${plural(res.catches, 'catch', 'catches')}.`
              : 'Nothing saved yet — save a spot, preset, or catch first.';
          })
        }
      >
        <Text style={styles.linkText}>Export backup file</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.linkBtn, pressed && pressedStyle]}
        onPress={() =>
          run(async () => {
            const res = await importBackup();
            if (!res) return null; // picker canceled
            return res.spots === 0 && res.presets === 0 && res.catches === 0
              ? 'Nothing new to import — everything in that file is already here.'
              : `Imported ${plural(res.spots, 'new spot')}, ${plural(res.presets, 'new preset')}, and ${plural(res.catches, 'new catch', 'new catches')}.`;
          })
        }
      >
        <Text style={styles.linkText}>Import backup file</Text>
      </Pressable>
      {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
    </Section>
  );
}

function ProSection() {
  const styles = useStyles();
  const { isPro, canSubscribe, showPaywall, restore, busy } = usePro();
  const [status, setStatus] = useState<string | null>(null);

  // A subscription follows the Google account that bought it — Play restores
  // it automatically on reinstall/new phone, and this button forces a re-check
  // for anyone it missed.
  const onRestore = async () => {
    if (busy) return;
    setStatus(null);
    const result = await restore();
    if (result === 'restored') setStatus('Subscription restored — welcome back!');
    if (result === 'none')
      setStatus(
        'No subscription found. Make sure this device is signed into the Google account that purchased Pro.',
      );
    if (result === 'error') setStatus('Could not reach Google Play. Check your connection and try again.');
  };

  return (
    <Section title="bayLURE Pro">
      {isPro ? (
        <Text style={styles.para}>
          You're a Pro subscriber — unlimited saved spots, presets, and catches,
          with no ads. Manage or cancel anytime in Google Play → Subscriptions.
        </Text>
      ) : (
        <>
          <Text style={styles.para}>
            {canSubscribe
              ? 'Pro unlocks unlimited saved spots, presets, and catch log ' +
                'entries, and removes ads. Already subscribed on another ' +
                'phone? Your subscription follows your Google account — ' +
                'restore it below.'
              : 'Pro removes ads and keeps every spot, preset, and catch ' +
                'unlocked. Subscriptions are coming soon — have a redeem ' +
                'code? Enter it from the Pro screen below.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && pressedStyle]}
            onPress={showPaywall}
          >
            <Text style={styles.linkText}>See bayLURE Pro</Text>
          </Pressable>
          {canSubscribe ? (
            <Pressable
              style={({ pressed }) => [styles.linkBtn, pressed && pressedStyle]}
              onPress={onRestore}
            >
              <Text style={styles.linkText}>Restore purchases</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {status ? <Text style={styles.backupStatus}>{status}</Text> : null}
    </Section>
  );
}

function Row({ item }: { item: Item }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Feather name="square" size={16} color={colors.accent} style={styles.check} />
      <View style={styles.rowText}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.why}>{item.why}</Text>
      </View>
    </View>
  );
}

export function HelpScreen() {
  const styles = useStyles();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <BrandHeader
        heading="Guide"
        subtitle="Everything for a day on the water, starting from nothing."
        display
      />

      <View style={styles.body}>
      <Section title="The Essentials">
        {ESSENTIALS.map((i) => (
          <Row key={i.name} item={i} />
        ))}
      </Section>

      <Section title="Comfort, Safety & Legal">
        {COMFORT.map((i) => (
          <Row key={i.name} item={i} />
        ))}
      </Section>

      <Section title="Freshwater vs. Saltwater Starter">
        <Text style={styles.para}>
          <Text style={styles.bold}>Freshwater (lakes/ponds/rivers):</Text> a
          medium spinning combo, 8–10 lb mono, a few jigheads + soft plastics,
          bobbers, split shot, and a tub of nightcrawlers will catch bass,
          panfish, catfish, and trout.
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Saltwater (inshore):</Text> step up to a
          medium-heavy combo, 10–20 lb braid with a 20–30 lb fluorocarbon leader
          (salt fish have teeth and good eyes), circle hooks, popping corks, and
          live or dead shrimp. Rinse your gear with fresh water afterward — salt
          corrodes everything.
        </Text>
      </Section>

      <BackupSection />

      <ProSection />

      <Section title="A Simple First Rig">
        <Text style={styles.para}>
          1. Tie your hook to the line with a clinch knot. 2. Pinch a split shot
          12–18" above the hook. 3. Clip a bobber on another 1–3' up. 4. Bait the
          hook, cast out, and watch the bobber — when it goes under, reel down and
          lift the rod to set the hook.
        </Text>
        <Text style={styles.para}>
          Use the Plan tab to see what the fish are doing and which lures, rods,
          lines, and hooks to use for the conditions where you are.
        </Text>
      </Section>

      <Text style={styles.footer}>
        Buy a license, learn your local size/bag limits, handle fish gently, and
        pack out your trash. Tight lines.
      </Text>
      <Text style={styles.footer}>
        Weather, tides & charts: NOAA / National Weather Service · Pressure
        forecast: MET Norway (CC BY 4.0) · Depth: NOAA NCEI · Maps: USGS
      </Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl * 2 },
  body: { paddingHorizontal: spacing.lg },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  check: {
    color: colors.accent,
    fontSize: 16,
    marginRight: spacing.sm,
  },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  why: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  para: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  bold: { fontWeight: '800' },
  linkBtn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  linkText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  backupStatus: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.lg,
    opacity: 0.8,
  },
}));
