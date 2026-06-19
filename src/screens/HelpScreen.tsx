import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

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

function Row({ item }: { item: Item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.check}>▢</Text>
      <View style={styles.rowText}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.why}>{item.why}</Text>
      </View>
    </View>
  );
}

export function HelpScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.brand}>Guide</Text>
      <Text style={styles.tagline}>
        Never fished before? Here's everything you need for a day on the water,
        starting from nothing.
      </Text>

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

      <Pressable
        style={styles.linkBtn}
        onPress={() =>
          Linking.openURL(
            'https://www.takemefishing.com/how-to-fish/fishing-for-beginners/',
          )
        }
      >
        <Text style={styles.linkText}>More beginner how-to guides  ↗</Text>
      </Pressable>

      <Text style={styles.footer}>
        Buy a license, learn your local size/bag limits, handle fish gently, and
        pack out your trash. Tight lines.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
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
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.lg,
    opacity: 0.8,
  },
});
