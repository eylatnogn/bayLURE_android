// A compact search-to-select field: type a few letters, tap a match — or tap
// the "Use …" row to keep exactly what you typed as a custom entry. Replaces
// the long chip walls / radio lists on the catch form.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

export interface SearchPickOption {
  name: string;
  /** Small category tag shown on the row, e.g. "LURE". */
  tag?: string;
}

interface Props {
  placeholder: string;
  options: SearchPickOption[];
  /** Called with the chosen name; `custom` is true for free-typed entries. */
  onPick: (name: string, custom: boolean) => void;
  /** Max matches to show under the input. */
  maxResults?: number;
  /** Offer the "Use …" free-text row (off for lists that need known ids). */
  allowCustom?: boolean;
}

export function SearchPick({
  placeholder,
  options,
  onPick,
  maxResults = 6,
  allowCustom = true,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, maxResults)
    : [];
  const exact = matches.some((o) => o.name.toLowerCase() === q);

  const pick = (name: string, custom: boolean) => {
    setQuery('');
    onPick(name, custom);
  };

  return (
    <View>
      <View style={styles.inputRow}>
        <Feather name="search" size={15} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={styles.input}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Feather name="x" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {q ? (
        <View style={styles.results}>
          {matches.map((o) => (
            <Pressable
              key={o.name}
              onPress={() => pick(o.name, false)}
              style={({ pressed }) => [styles.row, pressed && pressedStyle]}
            >
              <Text style={styles.rowText}>{o.name}</Text>
              {o.tag ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{o.tag}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
          {allowCustom && !exact ? (
            <Pressable
              onPress={() => pick(query.trim(), true)}
              style={({ pressed }) => [styles.row, styles.customRow, pressed && pressedStyle]}
            >
              <Feather name="plus" size={14} color={colors.accent} />
              <Text style={styles.customText}>Use “{query.trim()}”</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.text,
  },
  results: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.cardBorder,
  },
  rowText: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tag: {
    backgroundColor: c.chip,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  customRow: {
    borderStyle: 'dashed',
    borderColor: c.accent,
    backgroundColor: 'transparent',
  },
  customText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '700',
  },
}));
