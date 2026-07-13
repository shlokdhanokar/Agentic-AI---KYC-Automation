with open('.env', 'rb') as f:
    data = f.read()
data = data.replace(b'\x00', b'')
# Also make sure there are no weird UTF-16 BOMs
if data.startswith(b'\xff\xfe'):
    data = data[2:]
with open('.env', 'wb') as f:
    f.write(data)
