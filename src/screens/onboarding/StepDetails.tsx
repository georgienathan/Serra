import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

type Props = {
  preferredName: string;
  setPreferredName: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  menstruating: boolean | null;
  setMenstruating: (v: boolean) => void;
  activityLevel: 'beginner' | 'intermediate' | 'advanced' | '';
  setActivityLevel: (v: 'beginner' | 'intermediate' | 'advanced') => void;
  disability: string;
  setDisability: (v: string) => void;
  childrenStatus: 'none' | 'baby' | 'toddler' | 'child' | 'teenager' | 'not_dependent' | '';
  setChildrenStatus: (v: Props['childrenStatus']) => void;
  onNext: () => void;
};

export default function StepDetails(props: Props) {
  const {
    preferredName, setPreferredName,
    age, setAge,
    menstruating, setMenstruating,
    activityLevel, setActivityLevel,
    disability, setDisability,
    childrenStatus, setChildrenStatus,
    onNext,
  } = props;

  const Btn = ({ label, onPress, selected }: {label: string; onPress: () => void; selected?: boolean}) => (
    <Pressable onPress={onPress} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: selected ? '#111827' : '#ccc', marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: selected ? '#111827' : '#333' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Welcome to Serra!</Text>

      <TextInput placeholder="Preferred Name?" value={preferredName} onChangeText={setPreferredName}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />

      <TextInput placeholder="Age?" keyboardType="number-pad" value={age} onChangeText={setAge}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />

      <Text style={{ marginTop: 6, marginBottom: 6 }}>Menstruating?</Text>
      <View style={{ flexDirection:'row', marginBottom:10 }}>
        <Btn label="Yes" onPress={() => setMenstruating(true)} selected={menstruating === true} />
        <Btn label="No" onPress={() => setMenstruating(false)} selected={menstruating === false} />
      </View>

      <Text style={{ marginTop: 6, marginBottom: 6 }}>Activity Level</Text>
      <View style={{ flexDirection:'row', flexWrap: 'wrap', marginBottom:10 }}>
        {(['beginner','intermediate','advanced'] as const).map(a => (
          <Btn key={a} label={a} onPress={() => setActivityLevel(a)} selected={activityLevel === a} />
        ))}
      </View>

      <TextInput placeholder="Disability? (optional)" value={disability} onChangeText={setDisability}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />

      <Text style={{ marginTop: 6, marginBottom: 6 }}>Children?</Text>
      <View style={{ flexDirection:'row', flexWrap: 'wrap', marginBottom:18 }}>
        {(['none','baby','toddler','child','teenager','not_dependent'] as const).map(c => (
          <Btn key={c} label={c} onPress={() => setChildrenStatus(c)} selected={childrenStatus === c} />
        ))}
      </View>

      <Pressable onPress={onNext} style={{ backgroundColor: '#f7a1b2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Continue</Text>
      </Pressable>
    </View>
  );
}
