import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';

type Props = {
  clothes: string;
  setClothes: (v: string) => void;
  home: string;
  setHome: (v: string) => void;
  outdoors: string;
  setOutdoors: (v: string) => void;
  gym: string;
  setGym: (v: string) => void;
  onBack: () => void;
  onFinish: () => Promise<void>;
  saving: boolean;
};

export default function StepEquipment(props: Props) {
  const { clothes, setClothes, home, setHome, outdoors, setOutdoors, gym, setGym, onBack, onFinish, saving } = props;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>What equipment do you have?</Text>

      <TextInput placeholder="Clothes (comma separated)" value={clothes} onChangeText={setClothes}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />
      <TextInput placeholder="Home" value={home} onChangeText={setHome}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />
      <TextInput placeholder="Outdoors" value={outdoors} onChangeText={setOutdoors}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:10 }} />
      <TextInput placeholder="Gym" value={gym} onChangeText={setGym}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:18 }} />

      <View style={{ flexDirection: 'row', justifyContent:'space-between' }}>
        <Pressable onPress={onBack} style={{ backgroundColor: '#e5e7eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#111827', fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Pressable onPress={onFinish} disabled={saving} style={{ backgroundColor: '#f7a1b2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginLeft: 8, opacity: saving ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Finish Sign Up</Text>}
        </Pressable>
      </View>
    </View>
  );
}
