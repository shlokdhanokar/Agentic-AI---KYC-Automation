import csv
import random

# Real and realistic mock sanctioned entities
entries = [
    ("Osama Bin Laden", "Usama Bin Ladin", "Terrorism", "Global Terrorism"),
    ("Pablo Escobar", "El Patron", "Drug Trafficking", "Narcotics"),
    ("Joaquin Guzman Loera", "El Chapo", "Drug Trafficking", "Narcotics"),
    ("Ayman al-Zawahiri", "The Doctor", "Terrorism", "Global Terrorism"),
    ("Dawood Ibrahim", "Dawood Bhai", "Organized Crime", "Terrorism/Money Laundering"),
    ("Semion Mogilevich", "The Brainy Don", "Organized Crime", "Money Laundering/Fraud"),
    ("Matteo Messina Denaro", "Diabolik", "Organized Crime", "Mafia"),
    ("Ismael Zambada Garcia", "El Mayo", "Drug Trafficking", "Narcotics"),
    ("Abu Bakr al-Baghdadi", "Abu Dua", "Terrorism", "Global Terrorism"),
    ("Hassan Nasrallah", "Sayyed Hassan", "Terrorism", "Global Terrorism"),
    ("Rafael Caro Quintero", "Rafa", "Drug Trafficking", "Narcotics"),
    ("Amado Carrillo Fuentes", "Lord of the Skies", "Drug Trafficking", "Narcotics"),
    ("Ovidio Guzman Lopez", "El Raton", "Drug Trafficking", "Narcotics"),
    ("Nemeso Oseguera Cervantes", "El Mencho", "Drug Trafficking", "Narcotics"),
    ("Tarik bin al-Tahar", "Abu Omar", "Terrorism", "Global Terrorism"),
    ("Samantha Lewthwaite", "White Widow", "Terrorism", "Global Terrorism"),
    ("Viktor Bout", "Merchant of Death", "Arms Trafficking", "Arms Proliferation"),
    ("Felicien Kabuga", "The Financier", "Genocide", "Crimes Against Humanity"),
    ("Joseph Kony", "Kony", "War Crimes", "Crimes Against Humanity"),
    ("Abubakar Shekau", "Darul Tawheed", "Terrorism", "Global Terrorism")
]

# Generate additional realistic synthetic names to reach 100
first_names = ["Ali", "Mohammad", "Carlos", "Luis", "Ivan", "Vladimir", "Dmitry", "Sergei", "Abdul", "Omar", "Tariq", "Hassan", "Ibrahim", "Youssef", "Khaled", "Juan", "Pedro", "Miguel", "Alejandro", "Javier"]
last_names = ["Al-Fayed", "Kadyrov", "Volkov", "Sokolov", "Mendoza", "Rodriguez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Cruz", "Reyes"]
akas = ["The Ghost", "El Diablo", "The Shadow", "Viper", "Cobra", "The Fox", "Scarface", "The Baron", "The Professor", "The Butcher", "The Surgeon", "The Mechanic", "The Architect", "The Banker", "The Broker", "The Smuggler", "The Courier", "The Enforcer", "The Fixer", "The Cleaner"]
crimes = ["Money Laundering", "Cybercrime", "Human Trafficking", "Arms Smuggling", "Drug Trafficking", "Sanctions Evasion", "Proliferation Financing", "Terrorism Financing"]
categories = ["Financial Crime", "Cyber Security", "Transnational Crime", "Narcotics", "Global Terrorism", "Proliferation", "Sanctions Evasion"]

while len(entries) < 100:
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    aka = random.choice(akas)
    crime = random.choice(crimes)
    category = random.choice(categories)
    if (name, aka, crime, category) not in entries:
        entries.append((name, aka, crime, category))

# Also add our test user so we can test the rejection if we want, or keep it separate.
# We'll just stick to 100 bad actors.

# Save to CSV
with open("OFAC_SDN_LIST.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["Primary_Name", "AKA", "Crime_Description", "Category"])
    writer.writerows(entries)

print(f"Generated OFAC_SDN_LIST.csv with {len(entries)} entries.")
